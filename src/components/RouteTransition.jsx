import { motion } from 'framer-motion';

/**
 * Wrapper animasi perpindahan halaman — cepat dan tidak mengganggu kerja TU.
 *
 * Sengaja hanya memakai animasi masuk (fade-in) tanpa AnimatePresence:
 * animasi keluar yang tertahan pernah membuat konten halaman tidak muncul
 * sama sekali dan navigasi terasa membeku.
 */
export default function RouteTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
