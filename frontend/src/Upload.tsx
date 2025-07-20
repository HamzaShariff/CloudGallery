import { useRef } from 'react'
import axios from 'axios'

export function Upload({ onDone }: { onDone: () => void }) {
    const fileRef = useRef<HTMLInputElement>(null)

    async function handleFiles(files: FileList | null) {
        const file = files?.[0]
        if (!file) return
        
        try {
            const { data } = await axios.post(
                import.meta.env.VITE_API_URL + 'images',
                { contentType: file.type },
                { headers: { 'Content-Type': 'application/json' } }
            )

            await axios.put(data.uploadUrl, file, {
                headers: { 'Content-Type': file.type }
            })

            onDone()
        } catch (err) {
            console.error(err)

            alert('Upload failed')
        } finally {
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
    <>
      <button
        type="button"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => fileRef.current?.click()}
      >
        Upload
      </button>

      <input
        type="file"
        accept="image/*"
        hidden
        ref={fileRef}
        onChange={e => handleFiles(e.target.files)}
      />
    </>
  )
}