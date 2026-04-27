export default function GlobalLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0c0f16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        aria-label="Loading"
        role="status"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid rgba(6,182,212,0.15)',
          borderTopColor: 'rgba(6,182,212,0.9)',
          animation: 'roamSpin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes roamSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
