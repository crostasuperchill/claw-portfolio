export type Toy = 'pocketpet' | 'handheld' | 'floppy' | 'charm' | 'cartridge' | 'ball';

export type Project = {
  id: string;
  title: string;
  line: string;
  blurb: string;
  tags: string[];
  url: string;
  color: string;
  toy: Toy;
  cta: string;
};

export const PROJECTS: Project[] = [
  {
    id: 'magicwall',
    title: 'MagicWall',
    line: 'Video wallpapers for macOS',
    blurb: 'Local video wallpapers on every display. Native, offline, no sign-in.',
    tags: ['macOS', 'Swift', 'MIT'],
    url: 'https://magicwall.davide.fyi',
    color: '#2B4BFF',
    toy: 'handheld',
    cta: 'Open MagicWall',
  },
  {
    id: 'jollycat',
    title: 'Jollycat',
    line: 'The file converter macOS deserves',
    blurb: '80+ formats and 1,650+ conversion paths, all running locally on your Mac.',
    tags: ['macOS', 'Swift'],
    url: 'https://jollycat.app',
    color: '#FF3D7F',
    toy: 'pocketpet',
    cta: 'Open Jollycat',
  },
  {
    id: 'zora',
    title: 'ZORA Cartridges',
    line: 'A cartridge-shaped NFT series',
    blurb: 'Three palettes of collectible cartridges minted on Zora.',
    tags: ['NFT', '3D'],
    url: 'https://zora.co/collect/zora:0x6a6addd12dccc8a6d8c68a0a927eb7dda0200a3f/1',
    color: '#FFC21A',
    toy: 'cartridge',
    cta: 'Open on Zora',
  },
  {
    id: 'oracle',
    title: 'Oracle',
    line: 'Ask the ball, get an emoji',
    blurb: 'A little AI oracle that answers your question with a single magic emoji.',
    tags: ['AI', 'web'],
    url: 'https://davide.fyi',
    color: '#7A5CFF',
    toy: 'ball',
    cta: 'Visit davide.fyi',
  },
  {
    id: 'polaroids',
    title: 'Polaroids',
    line: 'Lofoten, on film',
    blurb: 'Segla, Flakstad, Reinebringen. Three mornings, one roll, no filter.',
    tags: ['photography', 'film'],
    url: 'https://www.instagram.com/davidebarbieri/',
    color: '#3FA98C',
    toy: 'floppy',
    cta: 'See the photos',
  },
  {
    id: 'contact',
    title: 'Say hi',
    line: 'The best prize is a message',
    blurb: 'Product engineer in Milan. Always up for a good side project.',
    tags: ['contact'],
    url: 'mailto:hello@davide.fyi',
    color: '#111111',
    toy: 'charm',
    cta: 'Write to Davide',
  },
];

export const byId = (id: string) => PROJECTS.find((p) => p.id === id);
