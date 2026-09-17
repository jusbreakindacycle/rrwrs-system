export function FormFeedback({ error, message }: { error: string; message: string }) {
  return <>{error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</>
}
