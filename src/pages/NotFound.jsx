import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Compass } from 'lucide-react';
import Logo from '../components/Logo';

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md text-center"
      >
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-8 grid h-16 w-16 mx-auto place-items-center rounded-2xl bg-primary-50 text-primary-600">
          <Compass size={30} />
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">404</h1>
        <p className="mt-2 text-sm text-slate-500">
          Halaman <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{location.pathname}</code>{' '}
          tidak ditemukan pada Sistem Tata Usaha.
        </p>

        <Link to="/" className="btn-primary mt-6">
          <ArrowLeft size={16} />
          Kembali ke Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
