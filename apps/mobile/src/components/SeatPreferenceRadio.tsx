import { SEAT_PREFERENCE, type SeatPreference } from '@sawari/constants';

import { type RadioOption, RadioList } from './RadioList';

const OPTIONS: RadioOption<SeatPreference>[] = [
  { value: SEAT_PREFERENCE.ANY, label: 'Any Seat' },
  { value: SEAT_PREFERENCE.BACK, label: 'Back Seat' },
  { value: SEAT_PREFERENCE.FRONT, label: 'Front Seat' },
];

export interface SeatPreferenceRadioProps {
  value: SeatPreference;
  onChange: (next: SeatPreference) => void;
}

export function SeatPreferenceRadio({ value, onChange }: SeatPreferenceRadioProps) {
  return <RadioList label="Seat preference" options={OPTIONS} value={value} onChange={onChange} />;
}
