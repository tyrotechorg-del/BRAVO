// Lightweight animated equalizer bars shown while audio plays.
// A CSS-driven stand-in for the original canvas Waveform — no Web Audio
// pipeline needed, so it stays cheap and always renders in the compact player.
export default function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`eq ${playing ? 'eq--playing' : ''}`} aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  )
}
