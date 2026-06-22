export default function CartaRedirect() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#faf7f2" }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🍣</p>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1210" }}>Carta no disponible</h1>
        <p className="text-sm" style={{ color: "#8c7e6a" }}>El enlace no es válido o ha expirado.</p>
      </div>
    </div>
  )
}
