/**
 * FR-001-004: a whole-number KB/MB readout of the device's stored data,
 * next to `StorageStatusSection`'s own line — computed fresh whenever this
 * section mounts (the Data section's own on-mount-read convention), never
 * cached and never a live/background-polling counter (Non-Goals).
 */
import { useEffect, useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { computeStorageSizeLabel } from '@/application/settings/storage-size';

export function StorageSizeSection() {
  const [label, setLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    void computeStorageSizeLabel(requireStorage()).then(setLabel);
  }, []);

  if (!label) return null;

  return <p className="settings-field-label">{label}</p>;
}
