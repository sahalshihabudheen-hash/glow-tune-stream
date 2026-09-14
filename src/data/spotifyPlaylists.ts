export interface SpotifyPlaylistTrack {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  cover: string;
  accentColor: string;
  category: 'pop' | 'hip-hop' | 'chill' | 'rock' | 'desi' | 'workout' | 'charts';
  followers: string;
  tracks: SpotifyPlaylistTrack[];
}

export const SPOTIFY_BUILTIN_PLAYLISTS: SpotifyPlaylist[] = [
  {
    id: 'spotify-todays-top-hits',
    name: "Today's Top Hits",
    description: "Jung Kook, Sabrina Carpenter, Billie Eilish & the hottest tracks in the world right now.",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
    accentColor: "#1db954",
    category: "pop",
    followers: "34,250,000",
    tracks: [
      {
        id: '4NRXx6U8ABQ',
        title: 'The Weeknd - Blinding Lights',
        thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
        channel: 'The Weeknd',
      },
      {
        id: 'H5v3kku4y6Q',
        title: 'Harry Styles - As It Was',
        thumbnail: 'https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg',
        channel: 'Harry Styles',
      },
      {
        id: 'TUVcZfQe-Kw',
        title: 'Dua Lipa - Levitating',
        thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg',
        channel: 'Dua Lipa',
      },
      {
        id: 'JGwWNGJdvx8',
        title: 'Ed Sheeran - Shape of You',
        thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
        channel: 'Ed Sheeran',
      },
      {
        id: 'fRh_vgS2dFE',
        title: 'Justin Bieber - Sorry',
        thumbnail: 'https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg',
        channel: 'Justin Bieber',
      },
      {
        id: 'OPf0YbXqDm0',
        title: 'Mark Ronson - Uptown Funk ft. Bruno Mars',
        thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg',
        channel: 'Mark Ronson',
      },
      {
        id: '09R8_2nJtjg',
        title: 'Maroon 5 - Sugar',
        thumbnail: 'https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg',
        channel: 'Maroon 5',
      },
      {
        id: 'kJQP7kiw5Fk',
        title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
        thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
        channel: 'Luis Fonsi',
      }
    ]
  },
  {
    id: 'spotify-top-50-global',
    name: "Top 50 - Global",
    description: "Your daily update of the most played tracks right now across the globe.",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
    accentColor: "#2e77d0",
    category: "charts",
    followers: "17,100,000",
    tracks: [
      {
        id: '3tmd-ClpJxA',
        title: 'Taylor Swift - Cruel Summer',
        thumbnail: 'https://i.ytimg.com/vi/3tmd-ClpJxA/hqdefault.jpg',
        channel: 'Taylor Swift',
      },
      {
        id: 'ApXoWvfEYVU',
        title: 'Post Malone, Swae Lee - Sunflower',
        thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg',
        channel: 'Post Malone',
      },
      {
        id: 'kTJczUoc26U',
        title: 'The Kid LAROI, Justin Bieber - STAY',
        thumbnail: 'https://i.ytimg.com/vi/kTJczUoc26U/hqdefault.jpg',
        channel: 'The Kid LAROI',
      },
      {
        id: '34Na4j8AVgA',
        title: 'The Weeknd - Starboy ft. Daft Punk',
        thumbnail: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
        channel: 'The Weeknd',
      },
      {
        id: '2Vv-BfVoq4g',
        title: 'Ed Sheeran - Perfect',
        thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
        channel: 'Ed Sheeran',
      },
      {
        id: 'RgKAFK5djSk',
        title: 'Wiz Khalifa - See You Again ft. Charlie Puth',
        thumbnail: 'https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg',
        channel: 'Wiz Khalifa',
      }
    ]
  },
  {
    id: 'spotify-rapcaviar',
    name: "RapCaviar",
    description: "New music from Kendrick Lamar, Travis Scott, Drake, 21 Savage and more.",
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80",
    accentColor: "#e91e63",
    category: "hip-hop",
    followers: "15,800,000",
    tracks: [
      {
        id: 'tvTRZJ-4EyI',
        title: 'Kendrick Lamar - HUMBLE.',
        thumbnail: 'https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg',
        channel: 'Kendrick Lamar',
      },
      {
        id: '6ONRf7h3Mdk',
        title: 'Travis Scott - SICKO MODE ft. Drake',
        thumbnail: 'https://i.ytimg.com/vi/6ONRf7h3Mdk/hqdefault.jpg',
        channel: 'Travis Scott',
      },
      {
        id: 'uxpDa-c-4Mc',
        title: "Drake - Hotline Bling",
        thumbnail: 'https://i.ytimg.com/vi/uxpDa-c-4Mc/hqdefault.jpg',
        channel: 'Drake',
      },
      {
        id: 'xpVfcZ0ZcFM',
        title: "Drake - God's Plan",
        thumbnail: 'https://i.ytimg.com/vi/xpVfcZ0ZcFM/hqdefault.jpg',
        channel: 'Drake',
      },
      {
        id: 'UqyT8IEBkvY',
        title: 'Post Malone - Congratulations ft. Quavo',
        thumbnail: 'https://i.ytimg.com/vi/UqyT8IEBkvY/hqdefault.jpg',
        channel: 'Post Malone',
      },
      {
        id: 'JFm7YDVlqnI',
        title: 'Eminem - Venom',
        thumbnail: 'https://i.ytimg.com/vi/JFm7YDVlqnI/hqdefault.jpg',
        channel: 'Eminem',
      }
    ]
  },
  {
    id: 'spotify-all-out-2010s',
    name: "All Out 2010s",
    description: "The biggest defining anthems and nostalgia of the 2010s decade.",
    cover: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80",
    accentColor: "#ff5722",
    category: "pop",
    followers: "12,400,000",
    tracks: [
      {
        id: 'IcrbM1l_BoI',
        title: 'Avicii - Wake Me Up',
        thumbnail: 'https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg',
        channel: 'Avicii',
      },
      {
        id: 'PT2_F-1esPk',
        title: 'The Chainsmokers - Closer ft. Halsey',
        thumbnail: 'https://i.ytimg.com/vi/PT2_F-1esPk/hqdefault.jpg',
        channel: 'The Chainsmokers',
      },
      {
        id: 'CevxZvSJLk8',
        title: 'Katy Perry - Roar',
        thumbnail: 'https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg',
        channel: 'Katy Perry',
      },
      {
        id: 'pRpeEdMmmQ0',
        title: 'Shakira - Waka Waka (This Time for Africa)',
        thumbnail: 'https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg',
        channel: 'Shakira',
      },
      {
        id: '9bZkp7q19f0',
        title: 'PSY - GANGNAM STYLE',
        thumbnail: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',
        channel: 'officialpsy',
      },
      {
        id: 'lDK9QqIzhwk',
        title: 'Maroon 5 - Girls Like You ft. Cardi B',
        thumbnail: 'https://i.ytimg.com/vi/lDK9QqIzhwk/hqdefault.jpg',
        channel: 'Maroon 5',
      }
    ]
  },
  {
    id: 'spotify-chill-lofi-beats',
    name: "Chill Vibes & Lo-Fi",
    description: "Peaceful lo-fi hip hop beats and ambient textures to study, relax, and chill.",
    cover: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80",
    accentColor: "#9c27b0",
    category: "chill",
    followers: "8,900,000",
    tracks: [
      {
        id: 'jfKfPfyJRdk',
        title: 'Lofi Girl - Relaxing Lofi Hip Hop Beats',
        thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        channel: 'Lofi Girl',
      },
      {
        id: '5yx6BWlEVcY',
        title: 'Chillhop Music - Chillhop Essentials Lofi',
        thumbnail: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg',
        channel: 'Chillhop Music',
      },
      {
        id: 'rUxyKA_-grg',
        title: 'The Weeknd - Call Out My Name',
        thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault.jpg',
        channel: 'The Weeknd',
      },
      {
        id: 'hLQl3WQQoQ0',
        title: 'Adele - Someone Like You',
        thumbnail: 'https://i.ytimg.com/vi/hLQl3WQQoQ0/hqdefault.jpg',
        channel: 'Adele',
      }
    ]
  },
  {
    id: 'spotify-bollywood-butter',
    name: "Bollywood Butter & Desi Hits",
    description: "The most sensational Bollywood melodies and chartbusters right now.",
    cover: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&auto=format&fit=crop&q=80",
    accentColor: "#ff9800",
    category: "desi",
    followers: "9,600,000",
    tracks: [
      {
        id: 'Umqb9KENgmk',
        title: 'Arijit Singh - Kesariya (Brahmāstra)',
        thumbnail: 'https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg',
        channel: 'Sony Music India',
      },
      {
        id: 'kJQP7kiw5Fk',
        title: 'Desi Boyz - Subha Hone Na De',
        thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
        channel: 'T-Series',
      },
      {
        id: 'JGwWNGJdvx8',
        title: 'Diljit Dosanjh - Lover',
        thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
        channel: 'Diljit Dosanjh',
      },
      {
        id: '3tmd-ClpJxA',
        title: 'Arijit Singh, Shreya Ghoshal - Tum Kya Mile',
        thumbnail: 'https://i.ytimg.com/vi/3tmd-ClpJxA/hqdefault.jpg',
        channel: 'Saregama Music',
      }
    ]
  },
  {
    id: 'spotify-rock-classics',
    name: "Rock Classics",
    description: "Rock legends & epic anthems that define generations across time.",
    cover: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80",
    accentColor: "#f44336",
    category: "rock",
    followers: "11,500,000",
    tracks: [
      {
        id: 'fJ9rUzIMcZQ',
        title: 'Queen - Bohemian Rhapsody',
        thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
        channel: 'Queen Official',
      },
      {
        id: 'hTWKbfoikeg',
        title: 'Nirvana - Smells Like Teen Spirit',
        thumbnail: 'https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg',
        channel: 'Nirvana',
      },
      {
        id: '1w7OgIMMRc4',
        title: "Guns N' Roses - Sweet Child O' Mine",
        thumbnail: 'https://i.ytimg.com/vi/1w7OgIMMRc4/hqdefault.jpg',
        channel: "Guns N' Roses",
      },
      {
        id: 'kXYiU_JCYtU',
        title: 'Linkin Park - Numb',
        thumbnail: 'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg',
        channel: 'Linkin Park',
      },
      {
        id: 'eVTXPUF4Oz4',
        title: 'Linkin Park - In The End',
        thumbnail: 'https://i.ytimg.com/vi/eVTXPUF4Oz4/hqdefault.jpg',
        channel: 'Linkin Park',
      }
    ]
  },
  {
    id: 'spotify-beast-mode-workout',
    name: "Beast Mode Workout",
    description: "Fast-paced, heavy-hitting fuel to crush your workout session.",
    cover: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80",
    accentColor: "#00e676",
    category: "workout",
    followers: "10,200,000",
    tracks: [
      {
        id: '_Yhyp-_hX2s',
        title: 'Eminem - Lose Yourself',
        thumbnail: 'https://i.ytimg.com/vi/_Yhyp-_hX2s/hqdefault.jpg',
        channel: 'Eminem',
      },
      {
        id: '7wtfhZwyrcc',
        title: 'Imagine Dragons - Believer',
        thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg',
        channel: 'ImagineDragons',
      },
      {
        id: 'fKopy74weus',
        title: 'Imagine Dragons - Thunder',
        thumbnail: 'https://i.ytimg.com/vi/fKopy74weus/hqdefault.jpg',
        channel: 'ImagineDragons',
      },
      {
        id: 'IcrbM1l_BoI',
        title: 'Avicii - The Nights',
        thumbnail: 'https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg',
        channel: 'Avicii',
      }
    ]
  }
];

export function getSpotifyPlaylists(): SpotifyPlaylist[] {
  return SPOTIFY_BUILTIN_PLAYLISTS;
}

export function getSpotifyPlaylistById(id: string): SpotifyPlaylist | undefined {
  return SPOTIFY_BUILTIN_PLAYLISTS.find(p => p.id === id);
}

export function searchSpotifyPlaylists(query: string): SpotifyPlaylist[] {
  const q = query.toLowerCase().trim();
  if (!q) return SPOTIFY_BUILTIN_PLAYLISTS;
  return SPOTIFY_BUILTIN_PLAYLISTS.filter(
    p => p.name.toLowerCase().includes(q) ||
         p.description.toLowerCase().includes(q) ||
         p.category.toLowerCase().includes(q)
  );
}
