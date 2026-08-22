import React, { useState, useEffect, useRef } from 'react';
import '../styles/trip-chat-modal.css';
import { API_URL } from '../config';

function TripChatModal({ trip, driver, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      shipment_id: trip.shipment_id,
      sender_role: 'shipper',
      message: 'Hello! I\'ve accepted your bid. Please confirm pickup details.',
      timestamp: new Date().toISOString()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  // Add this inside TripChatModal component
useEffect(() => {
  if (!trip?.shipment_id) return;

  // Load messages initially
  loadMessages();

  // Auto-refresh every 3 seconds
  const interval = setInterval(() => {
    loadMessages();
  }, 3000);

  // Cleanup on unmount
  return () => clearInterval(interval);
}, [trip?.shipment_id]);

// Add this function
const loadMessages = async () => {
  try {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const response = await fetch(
      `${API_URL}/messages/${trip.shipment_id}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      setMessages(data.messages || []);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
};


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    setLoading(true);

    try {
      const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
      
      // Send to backend
      const response = await fetch(
        `${API_URL}/messages/${trip.shipment_id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: messageText.trim(),
            sender_role: 'driver'
          })
        }
      );

      if (response.ok) {
        // Add message to local state immediately
        const newMsg = {
          id: Date.now(),
          shipment_id: trip.shipment_id,
          sender_role: 'driver',
          message: messageText.trim(),
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        console.log('✅ Message sent');
      }
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="trip-chat-modal"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>💬 Chat with Shipper</h2>
          <p>Trip #{trip.shipment_id}</p>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Trip Info */}
      <div className="chat-trip-info">
        <div className="info-item">
          <span className="info-icon"></span>
          <div>
            <span className="info-label">Route</span>
            <span className="info-value">{trip.from_location} → {trip.to_location}</span>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">📦</span>
          <div>
            <span className="info-label">Package</span>
            <span className="info-value">{trip.package_type} ({trip.package_weight}kg)</span>
          </div>
        </div>
        <div className="info-item">
          <span className="info-icon">💰</span>
          <div>
            <span className="info-label">Amount</span>
            <span className="info-value">₹{trip.bid_amount}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.sender_role}`}>
            <div className="message-content">
              <div className="message-sender">
                {msg.sender_role === 'driver' ? '🚗 You' : '👤 Shipper'}
              </div>
              <p>{msg.message}</p>
              <small className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </small>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="chat-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          className="chat-input"
        />
        <button type="submit" disabled={loading} className="send-btn">
          {loading ? '⏳' : '📤'}
        </button>
      </form>
    </div>
  );
}

export default TripChatModal;
