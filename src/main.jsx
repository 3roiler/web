import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '../style.css';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { HomePage } from './pages/Home.jsx';
import { ImpressumPage } from './pages/Impressum.jsx';
import { DatenschutzPage } from './pages/Datenschutz.jsx';

createRoot(document.getElementById('root')).render(
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
