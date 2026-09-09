import { useParams, Link } from "react-router-dom";
import { useArtistById } from "@/hooks/useArtist";
import { useAuth } from "@/hooks/useAuth";
import SongPlayer from "@/components/SongPlayer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Music, Disc, Edit, Calendar } from "lucide-react";
import { format } from "date-fns";
import SEO from "@/components/SEO";

const ArtistProfile = () => {
  const { id } = useParams();
  const { artist, albums, loading } = useArtistById(id);
  const { user } = useAuth();

  const isOwner = user && artist && user.id === artist.user_id;
  const totalSongs = albums.reduce((acc, album) => acc + album.songs.length, 0);
  const latestAlbum = albums[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-24 mb-8" />
          <div className="flex flex-col md:flex-row gap-8">
            <Skeleton className="w-64 h-64 rounded-xl" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Artist Not Found</h1>
          <p className="text-muted-foreground mb-4">This artist profile doesn't exist.</p>
          <Link to="/artists">
            <Button>Browse Artists</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`${artist.artist_name} - Discography & Albums`}
        description={artist.bio || `Explore music tracks, albums, and discography from ${artist.artist_name} on NYRA.`}
        canonicalPath={`/artist/${id || ''}`}
        ogType="profile"
        ogImage={artist.image_url}
      />
      {/* Hero Section with gradient */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-background" />
        
        <div className="relative container mx-auto px-4 pt-6 pb-8">
          <Link to="/artists" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Artists
          </Link>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Album Cover */}
            <div className="shrink-0">
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-border/30">
                {latestAlbum?.cover_image_url || artist.profile_image_url ? (
                  <img
                    src={latestAlbum?.cover_image_url || artist.profile_image_url || ""}
                    alt={artist.artist_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                    <Music className="h-20 w-20 text-primary/50" />
                  </div>
                )}
              </div>
            </div>

            {/* Artist Info */}
            <div className="flex-1 flex flex-col justify-end">
              <p className="text-sm text-primary font-medium mb-2">ARTIST</p>
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
                {artist.artist_name}
              </h1>
              
              {artist.bio && (
                <p className="text-muted-foreground max-w-2xl mb-4">{artist.bio}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Disc className="h-4 w-4" />
                  {albums.length} {albums.length === 1 ? "Album" : "Albums"}
                </span>
                <span className="flex items-center gap-1">
                  <Music className="h-4 w-4" />
                  {totalSongs} {totalSongs === 1 ? "Song" : "Songs"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(artist.created_at), "MMM yyyy")}
                </span>
              </div>

              {isOwner && (
                <div className="mt-6">
                  <Link to="/become-artist">
                    <Button variant="outline" className="gap-2">
                      <Edit className="h-4 w-4" />
                      Manage Profile
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Albums & Songs */}
      <div className="container mx-auto px-4 py-8">
        {albums.length === 0 ? (
          <div className="text-center py-12">
            <Disc className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No albums yet</p>
          </div>
        ) : (
          <div className="space-y-12">
            {albums.map((album) => (
              <div key={album.id} className="space-y-6">
                {/* Album Header */}
                <div className="flex items-center gap-4">
                  {album.cover_image_url && (
                    <img
                      src={album.cover_image_url}
                      alt={album.album_name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{album.album_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {album.songs.length} {album.songs.length === 1 ? "song" : "songs"} • {format(new Date(album.created_at), "yyyy")}
                    </p>
                  </div>
                </div>

                {/* Songs List */}
                {album.songs.length === 0 ? (
                  <p className="text-muted-foreground text-sm pl-20">No songs in this album yet</p>
                ) : (
                  <div className="space-y-3">
                    {album.songs.map((song, index) => (
                      <div key={song.id} className="flex items-center gap-4">
                        <span className="w-8 text-center text-sm text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <SongPlayer
                            title={song.title}
                            description={song.description}
                            audioUrl={song.audio_url}
                            coverImageUrl={album.cover_image_url}
                            isCompact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistProfile;
