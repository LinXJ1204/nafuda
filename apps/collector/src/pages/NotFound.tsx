import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="font-serif text-4xl">Not found</h1>
      <p className="mt-3 text-muted">
        This page does not exist. <Link to="/" className="underline">Back home</Link>
      </p>
    </div>
  )
}
