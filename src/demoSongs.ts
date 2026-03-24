// Demo songs in AlphaTex format
// AlphaTex strings: 1=high e, 2=B, 3=G, 4=D, 5=A, 6=low E
// Note format: fret.string  Duration: :4=quarter :8=eighth :2=half
// r = rest  | = bar line

export interface DemoSong {
  title: string
  artist: string
  tex: string
}

export const DEMO_SONGS: DemoSong[] = [
  {
    title: 'Smoke on the Water',
    artist: 'Deep Purple',
    tex: [
      '\\title "Smoke on the Water"',
      '\\artist "Deep Purple"',
      '\\tempo 112',
      '.',
      ':8 5.6 r 8.6 r 10.6 8.6 r r |',
      ':8 5.6 r 8.6 r 10.6 12.6 10.6 r |',
      ':8 5.6 r 8.6 r 10.6 8.6 r r |',
      ':8 8.6 10.6 r 8.6 r r r r',
    ].join('\n'),
  },
  {
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
    tex: [
      '\\title "Seven Nation Army"',
      '\\artist "The White Stripes"',
      '\\tempo 124',
      '.',
      ':8 7.5 r 7.5 :16 10.5 :8 7.5 :16 6.5 :8 5.5 3.5 :4 2.5 |',
      ':8 7.5 r 7.5 :16 10.5 :8 7.5 :16 6.5 :8 5.5 :2 6.5 |',
      ':8 7.5 r 7.5 :16 10.5 :8 7.5 :16 6.5 :8 5.5 3.5 :4 2.5 |',
      ':8 7.5 r 7.5 :16 10.5 :8 7.5 :16 6.5 :8 5.5 :2 5.5',
    ].join('\n'),
  },
  {
    title: 'Come As You Are',
    artist: 'Nirvana',
    tex: [
      '\\title "Come As You Are"',
      '\\artist "Nirvana"',
      '\\tempo 120',
      '.',
      ':8 0.6 3.6 3.6 r 0.6 3.6 r 2.6 |',
      ':8 0.6 3.6 3.6 r 0.6 3.6 r 2.6 |',
      ':8 0.6 3.6 3.6 r 0.6 3.6 r 2.6 |',
      ':8 0.6 3.6 3.6 r 0.6 3.6 r 2.6',
    ].join('\n'),
  },
  {
    title: 'Back in Black',
    artist: 'AC/DC',
    tex: [
      '\\title "Back in Black"',
      '\\artist "AC/DC"',
      '\\tempo 196',
      '.',
      ':8 0.6 0.5 3.6 3.5 5.6 5.5 r 3.5 |',
      ':8 0.6 0.5 3.6 3.5 5.6 5.5 r 3.5 |',
      ':8 0.6 0.5 3.6 3.5 5.6 5.5 r 3.5 |',
      ':8 0.6 0.5 3.6 3.5 5.6 5.5 r 3.5',
    ].join('\n'),
  },
  {
    title: 'Wish You Were Here (Intro)',
    artist: 'Pink Floyd',
    tex: [
      '\\title "Wish You Were Here"',
      '\\artist "Pink Floyd"',
      '\\tempo 62',
      '.',
      ':4 0.3 2.4 0.4 2.5 0.5 |',
      ':4 0.3 2.4 0.4 2.5 0.5 |',
      ':4 0.3 2.4 0.4 2.5 :2 0.5 |',
      ':4 2.4 0.4 2.5 :2 0.5',
    ].join('\n'),
  },
]

export const DEFAULT_DEMO = DEMO_SONGS[0]
