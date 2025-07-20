import { use, useEffect, useState } from 'react'
import axios from 'axios'
import { Upload } from './Upload'

interface GalleryItem {
  imageId: string
  status: string
  thumbKey?: string
  labels?: string[]
}

export default function App() {
  const [items, setItems] = useState<GalleryItem[]>([])

  useEffect(() => {
    axios.get(import.meta.env.VITE_API_URL + 'images')
      .then(res => setItems(res.data))
      .catch(console.error)
  }, [])

  const fetchItems = () =>
    axios.get(import.meta.env.VITE_API_URL + 'images')
         .then(res => setItems(res.data))

  useEffect(() => { fetchItems() }, [])

  return (

    <main className="p-6 text-slate-800">
    <header className="flex items-center gap-4 mb-6">
      <h1 className="text-2xl font-bold flex-1">CloudGallery</h1>
      <Upload onDone={() => setTimeout(fetchItems, 4000)} />
    </header>

      {items.length === 0 && <p>No images yet.</p>}

      <ul className="space-y-4">
        {items.filter(i => i.status.trim() === 'READY').map(item => (
          <li key={item.imageId}>
            <img
              src={`https://${import.meta.env.VITE_CDN_DOMAIN}/${item.thumbKey}`}
              alt={item.imageId}
              className="inline-block rounded shadow"
            />
            <p className="mt-1 text-sm">
              {item.labels?.join(', ') ?? 'No labels'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
