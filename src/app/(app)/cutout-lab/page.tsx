import type { Metadata } from 'next';
import { CutoutLab } from '@/components/cutout-lab';

export const metadata: Metadata = { title: 'Cutout lab' };

/** A hidden test page (not linked from the app) for comparing background removal models on one photo. */
export default function CutoutLabPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Cutout lab</h1>
        <p className="text-muted">
          Pick a photo and run each model on it, one at a time. Nothing is uploaded or saved; the models run on this device. The first
          run of each model downloads it, so use Wi-Fi. The 176 MB and 200 MB ones need a phone with plenty of free memory, and may fail.
        </p>
      </div>
      <CutoutLab />
    </>
  );
}
