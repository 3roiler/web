import { Link } from 'react-router-dom';
export function Header() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-6 bg-slate-900/80 backdrop-blur-md px-6 py-4 sm:px-10 lg:px-16" id="global-nav">
      <Link to="/" className="text-base font-semibold text-cyan-400">broiler.dev</Link>
      <ul className="flex sm:gap-4">
        <li><a href="/#top" className="nav-link">Start</a></li>
        <li><a href="/#projects" className="nav-link">Projekte</a></li>
        <li><a href="/#contact" className="nav-link">Kontakt</a></li>
      </ul>
    </nav>
  );
}