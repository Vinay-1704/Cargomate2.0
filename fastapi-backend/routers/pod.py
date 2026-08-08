"""
Proof of Delivery (POD) router — two-step verification flow:
  1. Driver submits delivery photo + receiver name  → status = pending_verification
  2. Shipper views photo, signs digitally            → status = verified, delivery complete
"""

import io
import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user
from schemas import PODDriverSubmit, PODShipperVerify
import models

router = APIRouter()


# ─── 1. Driver submits POD ────────────────────────────────────────────────────

@router.post("/api/pod/submit")
def submit_pod(
    body: PODDriverSubmit,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[POD] Driver {current_user['id']} submitting POD for shipment {body.shipment_id}")

    # Verify the shipment exists and is active
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == body.shipment_id
    ).first()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment.status not in ("active", "in_transit"):
        raise HTTPException(status_code=400, detail=f"Shipment status is '{shipment.status}', cannot submit POD")

    # Check for existing POD
    existing = db.query(models.ProofOfDelivery).filter(
        models.ProofOfDelivery.shipment_id == body.shipment_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="POD already submitted for this shipment")

    # Create POD record
    pod_id = f"POD-{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    pod = models.ProofOfDelivery(
        pod_id=pod_id,
        shipment_id=body.shipment_id,
        trip_id=body.trip_id,
        driver_id=current_user["id"],
        shipper_id=shipment.shipper_id,
        delivery_photo=body.delivery_photo,
        receiver_name=body.receiver_name,
        driver_notes=body.driver_notes or "",
        status="pending_verification",
        delivered_at=datetime.now(timezone.utc),
    )
    db.add(pod)

    # Mark shipment as delivered (awaiting shipper verification)
    shipment.status = "delivered"

    # Mark trip as completed if trip_id provided
    if body.trip_id:
        trip = db.query(models.Trip).filter(
            models.Trip.trip_id == body.trip_id
        ).first()
        if trip:
            trip.status = "completed"
            trip.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(pod)

    print(f"[OK] POD {pod_id} created — awaiting shipper verification")

    return {
        "success": True,
        "message": "Proof of delivery submitted. Awaiting shipper verification.",
        "pod": {
            "pod_id": pod.pod_id,
            "shipment_id": pod.shipment_id,
            "status": pod.status,
            "receiver_name": pod.receiver_name,
            "delivered_at": pod.delivered_at.isoformat() if pod.delivered_at else None,
        },
    }


# ─── 2. Shipper verifies POD with digital signature ──────────────────────────

@router.put("/api/pod/{pod_id}/verify")
def verify_pod(
    pod_id: str,
    body: PODShipperVerify,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[POD] Shipper {current_user['id']} verifying POD {pod_id}")

    pod = db.query(models.ProofOfDelivery).filter(
        models.ProofOfDelivery.pod_id == pod_id
    ).first()

    if not pod:
        raise HTTPException(status_code=404, detail="POD not found")

    if pod.status == "verified":
        raise HTTPException(status_code=400, detail="POD already verified")

    # Save signature and mark verified
    pod.signature_data = body.signature_data
    pod.shipper_notes = body.shipper_notes or ""
    pod.status = "verified"
    pod.verified_at = datetime.now(timezone.utc)

    # Mark shipment as completed & paid
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == pod.shipment_id
    ).first()
    if shipment:
        shipment.status = "completed"
        shipment.payment_status = "paid"
        shipment.payment_date = datetime.now(timezone.utc)

    # Mark trip as completed & paid
    if pod.trip_id:
        trip = db.query(models.Trip).filter(models.Trip.trip_id == pod.trip_id).first()
        if trip:
            trip.status = "completed"
            trip.payment_status = "paid"

    db.commit()
    db.refresh(pod)

    print(f"[OK] POD {pod_id} verified — delivery confirmed")

    return {
        "success": True,
        "message": "Delivery verified successfully!",
        "pod": {
            "pod_id": pod.pod_id,
            "shipment_id": pod.shipment_id,
            "status": pod.status,
            "verified_at": pod.verified_at.isoformat() if pod.verified_at else None,
        },
    }


# ─── 3. Get POD by shipment ID ───────────────────────────────────────────────

@router.get("/api/pod/shipment/{shipment_id}")
def get_pod_by_shipment(
    shipment_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[POD] Fetching POD for shipment: {shipment_id}")

    pod = db.query(models.ProofOfDelivery).filter(
        models.ProofOfDelivery.shipment_id == shipment_id
    ).first()

    if not pod:
        return {"success": False, "pod": None}

    # Get driver and shipment info for display
    driver = db.query(models.User).filter(models.User.id == pod.driver_id).first()
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == shipment_id
    ).first()

    return {
        "success": True,
        "pod": {
            "pod_id": pod.pod_id,
            "shipment_id": pod.shipment_id,
            "trip_id": pod.trip_id,
            "driver_id": pod.driver_id,
            "driver_name": driver.name if driver else "Unknown",
            "delivery_photo": pod.delivery_photo,
            "receiver_name": pod.receiver_name,
            "driver_notes": pod.driver_notes,
            "signature_data": pod.signature_data,
            "shipper_notes": pod.shipper_notes,
            "status": pod.status,
            "delivered_at": pod.delivered_at.isoformat() if pod.delivered_at else None,
            "verified_at": pod.verified_at.isoformat() if pod.verified_at else None,
            "from_location": shipment.from_location if shipment else "",
            "to_location": shipment.to_location if shipment else "",
            "package_type": shipment.package_type if shipment else "",
            "package_weight": shipment.package_weight if shipment else 0,
            "final_amount": shipment.final_amount if shipment else 0,
            "payment_status": shipment.payment_status if shipment else "pending",
        },
    }


# ─── 4. Generate PDF ─────────────────────────────────────────────────────────

@router.get("/api/pod/{pod_id}/pdf")
def generate_pod_pdf(
    pod_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    print(f"[POD] Generating PDF for {pod_id}")

    pod = db.query(models.ProofOfDelivery).filter(
        models.ProofOfDelivery.pod_id == pod_id
    ).first()

    if not pod:
        raise HTTPException(status_code=404, detail="POD not found")

    driver = db.query(models.User).filter(models.User.id == pod.driver_id).first()
    shipment = db.query(models.Shipment).filter(
        models.Shipment.shipment_id == pod.shipment_id
    ).first()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Run: pip install reportlab")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=22, textColor=HexColor('#16a34a'), spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=HexColor('#64748b'), alignment=TA_CENTER, spaceAfter=20)
    heading_style = ParagraphStyle('SectionHead', parent=styles['Heading2'], fontSize=14, textColor=HexColor('#1e293b'), spaceBefore=14, spaceAfter=8)
    normal_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=11, textColor=HexColor('#334155'), spaceAfter=4)
    status_style = ParagraphStyle('Status', parent=styles['Normal'], fontSize=13, textColor=HexColor('#16a34a'), alignment=TA_CENTER, spaceBefore=10, spaceAfter=10)

    elements = []

    # Header
    elements.append(Paragraph("🚛 CargoMate", title_style))
    elements.append(Paragraph("Digital Proof of Delivery Certificate", subtitle_style))
    elements.append(Spacer(1, 4*mm))

    # Status
    status_text = "✅ DELIVERY VERIFIED" if pod.status == "verified" else "⏳ PENDING VERIFICATION"
    elements.append(Paragraph(status_text, status_style))
    elements.append(Spacer(1, 4*mm))

    # Shipment details table
    elements.append(Paragraph("Shipment Details", heading_style))
    shipment_data = [
        ["POD ID", pod.pod_id],
        ["Shipment ID", pod.shipment_id],
        ["From", shipment.from_location if shipment else "N/A"],
        ["To", shipment.to_location if shipment else "N/A"],
        ["Package", f"{shipment.package_type} ({shipment.package_weight}kg)" if shipment else "N/A"],
        ["Driver", driver.name if driver else "N/A"],
        ["Receiver", pod.receiver_name],
        ["Delivered At", pod.delivered_at.strftime("%B %d, %Y at %I:%M %p") if pod.delivered_at else "N/A"],
    ]

    if pod.verified_at:
        shipment_data.append(["Verified At", pod.verified_at.strftime("%B %d, %Y at %I:%M %p")])

    table = Table(shipment_data, colWidths=[120, 340])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#475569')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 6*mm))

    # Payment Settlement Details Table
    elements.append(Paragraph("Payment Settlement & Invoice Details", heading_style))
    amount_val = shipment.final_amount if (shipment and shipment.final_amount) else 0
    amount_str = f"INR {amount_val:,.2f}" if amount_val else "N/A"
    pay_status = (shipment.payment_status.upper() if shipment and shipment.payment_status else "PAID") if pod.status == "verified" else "PENDING"
    pay_date = shipment.payment_date.strftime("%B %d, %Y at %I:%M %p") if (shipment and shipment.payment_date) else (pod.verified_at.strftime("%B %d, %Y at %I:%M %p") if pod.verified_at else "N/A")

    payment_data = [
        ["Total Freight Charges", amount_str],
        ["Payment Status", f"PAID ({pay_status})" if pod.status == "verified" else "PENDING VERIFICATION"],
        ["Payment Gateway", "CargoMate Instant Digital Settlement"],
        ["Payment Timestamp", pay_date],
    ]

    pay_table = Table(payment_data, colWidths=[140, 320])
    pay_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#f0fdf4')),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#166534')),
        ('TEXTCOLOR', (1, 1), (1, 1), HexColor('#16a34a')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#bbf7d0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(pay_table)
    elements.append(Spacer(1, 6*mm))

    # Delivery Photo
    if pod.delivery_photo:
        elements.append(Paragraph("Delivery Photo", heading_style))
        try:
            photo_b64 = pod.delivery_photo
            if ',' in photo_b64:
                photo_b64 = photo_b64.split(',')[1]
            photo_bytes = base64.b64decode(photo_b64)
            photo_stream = io.BytesIO(photo_bytes)
            img = RLImage(photo_stream, width=200, height=150)
            elements.append(img)
        except Exception as e:
            elements.append(Paragraph(f"[Photo could not be rendered: {e}]", normal_style))
        elements.append(Spacer(1, 6*mm))

    # Signature
    if pod.signature_data:
        elements.append(Paragraph("Customer Signature (Shipper Verification)", heading_style))
        try:
            sig_b64 = pod.signature_data
            if ',' in sig_b64:
                sig_b64 = sig_b64.split(',')[1]
            sig_bytes = base64.b64decode(sig_b64)
            sig_stream = io.BytesIO(sig_bytes)
            sig_img = RLImage(sig_stream, width=200, height=80)
            elements.append(sig_img)
        except Exception as e:
            elements.append(Paragraph(f"[Signature could not be rendered: {e}]", normal_style))
        elements.append(Spacer(1, 6*mm))

    # Notes
    if pod.driver_notes:
        elements.append(Paragraph("Driver Notes", heading_style))
        elements.append(Paragraph(pod.driver_notes, normal_style))

    if pod.shipper_notes:
        elements.append(Paragraph("Shipper Notes", heading_style))
        elements.append(Paragraph(pod.shipper_notes, normal_style))

    # Footer
    elements.append(Spacer(1, 10*mm))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=HexColor('#94a3b8'), alignment=TA_CENTER)
    elements.append(Paragraph("This is a digitally generated document by CargoMate Logistics Platform.", footer_style))
    elements.append(Paragraph(f"Generated on {datetime.now(timezone.utc).strftime('%B %d, %Y at %I:%M %p UTC')}", footer_style))

    doc.build(elements)
    buffer.seek(0)

    print(f"[OK] PDF generated for {pod_id}")

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=POD-{pod.shipment_id}.pdf"},
    )
