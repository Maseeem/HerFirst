import React, { useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import './Navbar.css';

interface NavbarProps {
  onNewPlanClick: () => void;
  onSampleClick: () => void;
  onHowItWorksClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNewPlanClick,
  onSampleClick,
  onHowItWorksClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="navbar-header">
      <div className="container navbar-container">
        <div className="navbar-brand">
          <div className="navbar-logo-wrapper">
            <span className="navbar-logo-icon">✨</span>
            <div className="navbar-brand-text">
              <span className="navbar-title">HerFirst</span>
              <span className="navbar-tagline">Her Idea. Her Project. Her Step.</span>
            </div>
          </div>
          <Badge variant="amd" size="sm" className="navbar-hackathon-badge">
            AMD Hackathon ACT III
          </Badge>
        </div>

        {/* Desktop Navigation */}
        <nav className="navbar-nav desktop-only" aria-label="Main navigation">
          <button type="button" className="nav-link" onClick={onSampleClick}>
            Sample Blueprints
          </button>
          <button type="button" className="nav-link" onClick={onHowItWorksClick}>
            How It Works
          </button>
          <Button variant="primary" size="sm" onClick={onNewPlanClick}>
            + Start a Plan
          </Button>
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="mobile-menu-toggle mobile-only"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer mobile-only">
          <button
            type="button"
            className="mobile-nav-link"
            onClick={() => {
              onSampleClick();
              setMobileMenuOpen(false);
            }}
          >
            Sample Blueprints
          </button>
          <button
            type="button"
            className="mobile-nav-link"
            onClick={() => {
              onHowItWorksClick();
              setMobileMenuOpen(false);
            }}
          >
            How It Works
          </button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onNewPlanClick();
              setMobileMenuOpen(false);
            }}
          >
            + Start a Plan
          </Button>
        </div>
      )}
    </header>
  );
};
