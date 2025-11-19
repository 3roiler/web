import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { handleAuthCallback } from './services/service.ts';
import { Footer } from './components/Footer.jsx';
import { HomePage } from './pages/Home.jsx';
import { ImpressumPage } from './pages/Impressum.jsx';
import { DatenschutzPage } from './pages/Datenschutz.jsx';

function AppRoot() {
  useEffect(() => {
    // Capture potential auth callback params on initial mount
    handleAuthCallback();
  }, []);
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/datenschutz" element={<DatenschutzPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<AppRoot />);
