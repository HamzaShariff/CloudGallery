import { useRef } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuthenticator } from '@aws-amplify/ui-react';
import axios from 'axios';

interface Props {
  onDone: () => void;
  requireAuth: () => void;
}

export function Upload({ onDone, requireAuth }: Props) {
  const { user } = useAuthenticator(ctx => [ctx.user]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!user) {
      requireAuth();
      return;
    }

    try {
      const session  = await fetchAuthSession();
      const idToken  = session.tokens?.idToken?.toString() ?? '';

      const { data } = await axios.post(
        import.meta.env.VITE_API_URL + 'images',
        { contentType: file.type },
        { headers: { Authorization: idToken } }
      );

      await axios.put(data.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
      });

      onDone();
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
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
        hidden
        type="file"
        accept="image/*"
        ref={fileRef}
        onChange={e => handleFiles(e.target.files)}
      />
    </>
  );
}