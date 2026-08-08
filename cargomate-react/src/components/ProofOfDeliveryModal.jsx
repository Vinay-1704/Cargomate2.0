import React, { useState, useRef, useEffect } from 'react';
import '../styles/proof-of-delivery.css';

const API_URL = 'http://localhost:3000/api';

/**
 * ProofOfDeliveryModal handles:
 *  1. Driver Submission (mode="submit"): Upload delivery photo, receiver name, driver notes
 *  2. Shipper Verification (mode="verify"): View photo, sign on HTML5 Canvas, verify delivery
 *  3. View POD (mode="view"): View complete verified POD + Download PDF
 */
function ProofOfDeliveryModal({ shipment, trip, mode = 'submit', onClose, onSuccess }) {
  // Driver Submit State
  const [photo, setPhoto] = useState(null); // base64
  const [photoPreview, setPhotoPreview] = useState(null);
  const [receiverName, setReceiverName] = useState('');
  const [driverNotes, setDriverNotes] = useState('');

  // Shipper Verify State
  const [shipperNotes, setShipperNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef(null);

  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [podData, setPodData] = useState(null);

  const shipmentId = shipment?.shipment_id || trip?.shipment_id;
  const tripId = trip?.trip_id || shipment?.trip_id;

  // Load existing POD data if viewing or verifying
  useEffect(() => {
    if ((mode === 'verify' || mode === 'view') && shipmentId) {
      fetchPodData();
    }
  }, [shipmentId, mode]);

  const fetchPodData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/pod/shipment/${shipmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.pod) {
        setPodData(data.pod);
      } else {
        setError('Proof of delivery record not found');
      }
    } catch (err) {
      console.error('Error loading POD data:', err);
      setError('Failed to fetch POD details');
    } finally {
      setLoading(false);
    }
  };

  // ── Canvas Drawing Logic (Signature) ───────────────────────────────────────
  useEffect(() => {
    if ((mode === 'verify' || (mode === 'view' && podData?.signature_data)) && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#22c55e'; // Green signature stroke matching brand
    }
  }, [mode, podData]);

  const startDrawing = (e) => {
    if (mode !== 'verify') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing || mode !== 'verify') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // ── Handle Photo File Selection ───────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result);
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ── Driver Submission Handler ─────────────────────────────────────────────
  const handleSubmitPod = async (e) => {
    e.preventDefault();
    if (!photo) {
      alert('Please upload a delivery photo');
      return;
    }
    if (!receiverName.trim()) {
      alert('Please enter the receiver name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');

      const res = await fetch(`${API_URL}/pod/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
          trip_id: tripId,
          delivery_photo: photo,
          receiver_name: receiverName.trim(),
          driver_notes: driverNotes.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Proof of delivery submitted successfully! Awaiting customer signature verification.');
        if (onSuccess) onSuccess(data);
        onClose();
      } else {
        setError(data.detail || data.error || 'Failed to submit POD');
      }
    } catch (err) {
      console.error('Error submitting POD:', err);
      setError('Network error submitting POD');
    } finally {
      setLoading(false);
    }
  };

  // ── Shipper Verification Handler ──────────────────────────────────────────
  const handleVerifyPod = async (e) => {
    e.preventDefault();
    if (!hasSignature) {
      alert('Please sign on the signature canvas before confirming');
      return;
    }

    const canvas = canvasRef.current;
    const signatureBase64 = canvas.toDataURL('image/png');

    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');

      const res = await fetch(`${API_URL}/pod/${podData.pod_id}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          signature_data: signatureBase64,
          shipper_notes: shipperNotes.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Delivery verified & signed successfully! Shipment completed.');
        if (onSuccess) onSuccess(data);
        onClose();
      } else {
        setError(data.detail || data.error || 'Failed to verify delivery');
      }
    } catch (err) {
      console.error('Error verifying POD:', err);
      setError('Network error verifying delivery');
    } finally {
      setLoading(false);
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!podData?.pod_id) return;
    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      const res = await fetch(`${API_URL}/pod/${podData.pod_id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `POD-${shipmentId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Failed to download PDF');
      }
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Error downloading PDF document');
    }
  };

  return (
    <div className="pod-modal-overlay" onClick={onClose}>
      <div className="pod-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pod-modal-header">
          <h2>
            {mode === 'submit' && '📸 Digital Proof of Delivery'}
            {mode === 'verify' && '✍️ Verify Delivery & Customer Signature'}
            {mode === 'view' && '📄 Proof of Delivery Certificate'}
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="pod-error-banner">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {/* ────────────────── 1. DRIVER SUBMISSION MODE ────────────────── */}
        {mode === 'submit' && (
          <form onSubmit={handleSubmitPod} className="pod-form">
            <div className="pod-section-title">
              <span>Step 1: Upload Delivery Photo</span>
            </div>

            <div className="photo-upload-container">
              {photoPreview ? (
                <div className="photo-preview-box">
                  <img src={photoPreview} alt="Delivery Proof" />
                  <button
                    type="button"
                    className="btn-change-photo"
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                  >
                    🔄 Retake Photo
                  </button>
                </div>
              ) : (
                <label className="photo-upload-dropzone">
                  <i className="fas fa-camera dropzone-icon"></i>
                  <span>Take or Upload Package Photo</span>
                  <small>JPG, PNG up to 5MB</small>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <div className="pod-section-title">
              <span>Step 2: Receiver Information</span>
            </div>

            <div className="form-group">
              <label>Received By (Full Name) *</label>
              <input
                type="text"
                placeholder="e.g. John Doe / Store Manager"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Driver Notes (Optional)</label>
              <textarea
                placeholder="e.g. Package delivered at front reception counter"
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="pod-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Submitting...' : '🚀 Submit Delivery Photo'}
              </button>
            </div>
          </form>
        )}

        {/* ────────────────── 2. SHIPPER VERIFICATION & SIGNATURE MODE ────────────────── */}
        {mode === 'verify' && podData && (
          <form onSubmit={handleVerifyPod} className="pod-form">
            <div className="pod-info-summary">
              <div className="summary-row">
                <span>Shipment:</span> <strong>#{podData.shipment_id}</strong>
              </div>
              <div className="summary-row">
                <span>Route:</span> <strong>{podData.from_location} → {podData.to_location}</strong>
              </div>
              <div className="summary-row">
                <span>Driver:</span> <strong>{podData.driver_name}</strong>
              </div>
              <div className="summary-row">
                <span>Received By:</span> <strong>{podData.receiver_name}</strong>
              </div>
              <div className="summary-row">
                <span>Delivered At:</span> <strong>{new Date(podData.delivered_at).toLocaleString()}</strong>
              </div>
            </div>

            <div className="pod-section-title">
              <span>Driver's Delivery Photo</span>
            </div>
            {podData.delivery_photo && (
              <div className="pod-photo-display">
                <img src={podData.delivery_photo} alt="Proof of Delivery" />
              </div>
            )}

            {podData.driver_notes && (
              <div className="driver-notes-box">
                <small>Driver Note:</small>
                <p>"{podData.driver_notes}"</p>
              </div>
            )}

            <div className="pod-section-title">
              <span>Customer Signature Verification *</span>
            </div>

            <div className="signature-canvas-container">
              <canvas
                ref={canvasRef}
                width={500}
                height={160}
                className="signature-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="signature-actions">
                <small>Sign inside the green box above using finger or mouse</small>
                <button type="button" className="btn-clear-sig" onClick={clearCanvas}>
                  🧹 Clear
                </button>
              </div>
            </div>

            <div className="pod-section-title">
              <span>Delivery Payment & Settlement *</span>
            </div>

            {(() => {
              const amountDue = podData.final_amount || shipment?.final_amount || 0;
              return (
                <div className="payment-summary-box" style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <small style={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>Delivery Charge Payable</small>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e', marginTop: 2 }}>
                        ₹{amountDue ? amountDue.toLocaleString() : '—'}
                      </div>
                    </div>
                    <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      💳 Mandatory for Verification
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <small style={{ color: '#d1d5db', fontWeight: 600, fontSize: 12 }}>Payment Method:</small>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {[
                        { id: 'upi', label: '📱 Instant UPI / GPay' },
                        { id: 'card', label: '💳 Credit / Debit Card' },
                        { id: 'netbanking', label: '🏦 NetBanking' }
                      ].map(method => (
                        <button
                          key={method.id}
                          type="button"
                          style={{
                            background: paymentMethod === method.id ? '#22c55e' : 'rgba(255, 255, 255, 0.05)',
                            color: paymentMethod === method.id ? '#fff' : '#9ca3af',
                            border: paymentMethod === method.id ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '6px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => setPaymentMethod(method.id)}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="form-group">
              <label>Shipper Verification Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Verified goods received in perfect condition"
                value={shipperNotes}
                onChange={(e) => setShipperNotes(e.target.value)}
              />
            </div>

            <div className="pod-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button
                type="submit"
                className="btn btn-success"
                style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', fontWeight: 700, padding: '10px 20px' }}
                disabled={loading}
              >
                {loading
                  ? 'Processing Payment & Verifying...'
                  : `💳 Pay ₹${(podData.final_amount || shipment?.final_amount || 0).toLocaleString()} & Verify Delivery`
                }
              </button>
            </div>
          </form>
        )}

        {/* ────────────────── 3. VIEW COMPLETE POD CERTIFICATE ────────────────── */}
        {mode === 'view' && podData && (
          <div className="pod-view-container">
            <div className="pod-status-badge verified">
              <i className="fas fa-check-circle"></i> DELIVERY VERIFIED & COMPLETED
            </div>

            <div className="pod-info-summary">
              <div className="summary-row">
                <span>POD ID:</span> <strong>{podData.pod_id}</strong>
              </div>
              <div className="summary-row">
                <span>Shipment ID:</span> <strong>#{podData.shipment_id}</strong>
              </div>
              <div className="summary-row">
                <span>Driver:</span> <strong>{podData.driver_name}</strong>
              </div>
              <div className="summary-row">
                <span>Receiver:</span> <strong>{podData.receiver_name}</strong>
              </div>
              <div className="summary-row">
                <span>Delivered At:</span> <strong>{podData.delivered_at ? new Date(podData.delivered_at).toLocaleString() : 'N/A'}</strong>
              </div>
              {podData.verified_at && (
                <div className="summary-row">
                  <span>Verified At:</span> <strong>{new Date(podData.verified_at).toLocaleString()}</strong>
                </div>
              )}
            </div>

            <div className="pod-grid-images">
              <div className="image-block">
                <h4>📸 Delivery Photo</h4>
                <img src={podData.delivery_photo} alt="Delivery Photo" />
              </div>

              {podData.signature_data && (
                <div className="image-block">
                  <h4>✍️ Customer Signature</h4>
                  <div className="sig-preview-wrapper">
                    <img src={podData.signature_data} alt="Signature" />
                  </div>
                </div>
              )}
            </div>

            {podData.shipper_notes && (
              <div className="shipper-notes-box">
                <small>Shipper Verification Note:</small>
                <p>"{podData.shipper_notes}"</p>
              </div>
            )}

            <div className="pod-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf}>
                📥 Download PDF Certificate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProofOfDeliveryModal;
