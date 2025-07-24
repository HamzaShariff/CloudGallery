import { useEffect, useState } from 'react'
import axios from 'axios'
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Upload } from './Upload';

interface GalleryItem {
  imageId: string
  status: string
  thumbKey?: string
  labels?: string[]
}

export default function App() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const { user, signOut } = useAuthenticator(context => [context.user]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    axios.get(import.meta.env.VITE_API_URL + 'images')
      .then(res => setItems(res.data))
      .catch(console.error)
  }, [])

  const fetchItems = () =>
    axios.get(import.meta.env.VITE_API_URL + 'images')
      .then(res => setItems(res.data))

  console.table(items);
  console.table(items.map(i => ({ id: i.imageId, status: i.status })));

  return (
    <>
      {/* Sign‑in / sign‑up modal – opened only when the flag is true */}
      {authModalOpen && (
        <Authenticator
          variation="modal"
          loginMechanisms={['email']}
        >
          {({ user }) => {
            if (user) setAuthModalOpen(false);
            return <></>;
          }}
        </Authenticator>
      )}

      <main className="p-6 text-slate-800">
        <header className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold flex-1">CloudGallery</h1>

          {/* Top‑right auth button */}
          {user ? (
            <button
              onClick={() => signOut()}
              className="px-3 py-1 bg-slate-700 text-white rounded"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              Sign in
            </button>
          )}

          {/* Upload button component */}
          <Upload
            onDone={() => setTimeout(fetchItems, 5000)}
            requireAuth={() => setAuthModalOpen(true)}
          />
        </header>

        <ul className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items
            .filter(
              i => i.status?.trim().toUpperCase() === 'READY' && i.thumbKey
            )
            .map(({ imageId, thumbKey, labels }) => (
              <li key={imageId} className="space-y-1">
                <img
                  src={`https://${import.meta.env.VITE_CDN_DOMAIN}/${thumbKey}`}
                  alt={labels?.join(', ') ?? imageId}
                  className="w-full rounded shadow"
                />
                <p className="text-xs text-slate-600">
                  {labels?.join(', ') ?? 'No labels'}
                </p>
              </li>
            ))}
        </ul>
      </main>
    </>
  );
}
