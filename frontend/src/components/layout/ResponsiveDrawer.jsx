// src/components/layout/ResponsiveDrawer.jsx
// E6-responsive — pembalut sidebar.
// mobile (< md): drawer fixed yang slide guna translate + backdrop gelap.
// md+: kekal statik dalam aliran flex (sentiasa nampak).
// Tidak mengubah kandungan sidebar di dalamnya.

export default function ResponsiveDrawer({ open, onClose, children }) {
  return (
    <>
      {/* Backdrop — mobile sahaja, hanya bila drawer terbuka */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Bekas sidebar:
            mobile → fixed, slide guna translate-x
            md+    → static, sentiasa nampak */}
      <div
        className={
          'flex transition-transform duration-300 ease-in-out ' +
          'fixed inset-y-0 left-0 z-50 ' +
          (open ? 'translate-x-0 ' : '-translate-x-full ') +
          'md:static md:z-20 md:translate-x-0 md:shrink-0'
        }
      >
        {children}
      </div>
    </>
  );
}
