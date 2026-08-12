import React, { useEffect, useRef } from 'react';
import '../styles/index.css';

function HomePage() {
  const headerRef = useRef(null);
  const heroContentRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        if (window.scrollY > 80) {
          headerRef.current.classList.add('scrolled');
        } else {
          headerRef.current.classList.remove('scrolled');
        }
      }
    };

    window.addEventListener('scroll', handleScroll);

    if (heroContentRef.current) {
      const elements = Array.from(heroContentRef.current.children);
      elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(25px)';
        
        setTimeout(() => {
          element.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, index * 150);
      });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="landing-page-root">
      {/* Navigation Header */}
      <header className="header" id="header" ref={headerRef}>
        <div className="logo">
          <i className="fas fa-truck"></i>
          <span>CargoMate<small className="logo-badge">2.0</small></span>
        </div>
        
        <div className="nav-actions">
          <a href="/login" className="nav-login-btn">Sign In</a>
          <a href="/signup" className="contact-btn">Get Started Free</a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="hero">
        {/* Floating Ambient Glow Background Elements */}
        <div className="ambient-glow glow-1"></div>
        <div className="ambient-glow glow-2"></div>

        {/* Floating Glass Badges */}
        <div className="floating-badge badge-left">
          <span className="badge-icon">📦</span>
          <div>
            <strong>10,000+</strong>
            <small>Active Deliveries</small>
          </div>
        </div>

        <div className="floating-badge badge-right">
          <span className="badge-icon">⚡</span>
          <div>
            <strong>99.8%</strong>
            <small>On-Time ETA Rate</small>
          </div>
        </div>

        <div className="hero-content" ref={heroContentRef}>
          <div className="hero-top-tag">
            <span className="pulse-dot"></span>
            <span>NEXT-GEN AI FREIGHT & FLEET PLATFORM</span>
          </div>

          <h1>
            The #1 Connection &<br />
            Service Partner for<br />
            <span className="highlight-gradient">Smart Transportation Networks</span>
          </h1>

          <p>
            Unlock competitive freight rates, calculate turn-by-turn road routes, verify digital proof of delivery, and track your fleet in real-time across India.
          </p>

          <div className="hero-cta-group">
            <a href="/login" className="cta-button primary-cta">
              <span>🚀 Launch Shipper Portal</span>
              <i className="fas fa-arrow-right"></i>
            </a>
            <a href="/login" className="cta-button secondary-cta">
              <i className="fas fa-truck-moving"></i>
              <span>Driver & Transporter Hub</span>
            </a>
          </div>
        </div>
      </main>

      {/* Real-time Platform Metrics Bar */}
      <section className="metrics-banner">
        <div className="metrics-container">
          <div className="metric-box">
            <span className="metric-number">₹50M+</span>
            <span className="metric-label">Freight Value Processed</span>
          </div>
          <div className="metric-divider"></div>
          <div className="metric-box">
            <span className="metric-number">5,000+</span>
            <span className="metric-label">Verified Transporters</span>
          </div>
          <div className="metric-divider"></div>
          <div className="metric-box">
            <span className="metric-number">500+</span>
            <span className="metric-label">Indian Cities Connected</span>
          </div>
          <div className="metric-divider"></div>
          <div className="metric-box">
            <span className="metric-number">0.8s</span>
            <span className="metric-label">AI Route Calculation</span>
          </div>
        </div>
      </section>

      {/* Feature Matrix Section */}
      <section className="features-section">
        <div className="section-title-box">
          <span className="section-badge">POWERFUL CAPABILITIES</span>
          <h2>Everything You Need for Modern Logistics</h2>
          <p>Engineered for shippers, fleet operators, and independent drivers.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper green">
              <i className="fas fa-route"></i>
            </div>
            <h3>AI Route Optimizer</h3>
            <p>Calculate 3 distinct turn-by-turn road strategies: Fastest (Minimum ETA), Shortest Mileage, and Lowest Fuel-Cost with exact highway geometry.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper blue">
              <i className="fas fa-file-signature"></i>
            </div>
            <h3>Digital Proof of Delivery (POD)</h3>
            <p>Upload delivery photos, capture receiver canvas signatures, enforce instant payment verification, and generate PDF certificates.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper purple">
              <i className="fas fa-satellite-dish"></i>
            </div>
            <h3>Live GPS Fleet Tracking</h3>
            <p>Track shipment locations live on interactive Leaflet maps with real-time ETA updates, speed alerts, and direct driver chat.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper orange">
              <i className="fas fa-shield-alt"></i>
            </div>
            <h3>Secure Bidding & Payments</h3>
            <p>Shippers receive instant competitive bids from verified transporters with automated payment lock-step protection.</p>
          </div>
        </div>
      </section>

      {/* Industry Partners Marquee Section */}
      <section className="partners-section">
        <div className="partners-container">
          <h3 className="partners-title">TRUSTED BY INDUSTRY LOGISTICS LEADERS</h3>
          <div className="partners-grid">
            <div className="partner-item">
              <i className="fas fa-shipping-fast"></i>
              <span>LogiTrans</span>
            </div>
            <div className="partner-item">
              <i className="fas fa-truck-moving"></i>
              <span>SwiftMove</span>
            </div>
            <div className="partner-item">
              <i className="fas fa-route"></i>
              <span>RouteMax</span>
            </div>
            <div className="partner-item">
              <i className="fas fa-warehouse"></i>
              <span>CargoHub</span>
            </div>
            <div className="partner-item">
              <i className="fas fa-ship"></i>
              <span>NaviFleet</span>
            </div>
            <div className="partner-item">
              <i className="fas fa-box"></i>
              <span>PackageLink</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="logo">
              <i className="fas fa-truck"></i>
              <span>CargoMate 2.0</span>
            </div>
            <p>© 2026 CargoMate Technologies Inc. All rights reserved.</p>
          </div>
          <div className="footer-links">
            <a href="/login">Shipper Portal</a>
            <a href="/login">Driver Hub</a>
            <a href="/signup">Create Account</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
