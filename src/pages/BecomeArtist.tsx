import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useArtist } from "@/hooks/useArtist";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Upload, Disc, Plus, Loader2, Image, ArrowLeft, Trash2, UserX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const BecomeArtist = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myArtistProfile, myAlbums, loading, registerAsArtist, createAlbum, uploadSong, deleteAlbum, deleteArtistProfile, refetch } = useArtist();
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  // Registration form
  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [registering, setRegistering] = useState(false);

  // Album form
  const [albumName, setAlbumName] = useState("");
  const [albumCover, setAlbumCover] = useState<File | null>(null);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const albumCoverRef = useRef<HTMLInputElement>(null);

  // Song form
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songDescription, setSongDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingSong, setUploadingSong] = useState(false);
  const audioFileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Music className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to become an artist</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleRegister = async () => {
    if (!artistName.trim()) {
      toast.error("Please enter an artist name");
      return;
    }
    setRegistering(true);
    const result = await registerAsArtist(artistName.trim(), bio.trim() || undefined);
    setRegistering(false);
    if (result) {
      setArtistName("");
      setBio("");
    }
  };

  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      toast.error("Please enter an album name");
      return;
    }
    setCreatingAlbum(true);
    const result = await createAlbum(albumName.trim(), albumCover || undefined);
    setCreatingAlbum(false);
    if (result) {
      setAlbumName("");
      setAlbumCover(null);
      if (albumCoverRef.current) albumCoverRef.current.value = "";
    }
  };

  const handleUploadSong = async () => {
    if (!selectedAlbumId) {
      toast.error("Please select an album");
      return;
    }
    if (!songTitle.trim()) {
      toast.error("Please enter a song title");
      return;
    }
    if (!audioFile) {
      toast.error("Please select an audio file");
      return;
    }
    setUploadingSong(true);
    const result = await uploadSong(selectedAlbumId, songTitle.trim(), audioFile, songDescription.trim() || undefined);
    setUploadingSong(false);
    if (result) {
      setSongTitle("");
      setSongDescription("");
      setAudioFile(null);
      if (audioFileRef.current) audioFileRef.current.value = "";
      refetch();
    }
  };

  // Not registered yet
  if (!myArtistProfile) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="Artist Portal - Join & Share Music" 
          canonicalPath="/become-artist"
          description="Join the NYRA Artist Community. Share your tracks and albums with music lovers worldwide with zero barriers."
        />
        <div className="container mx-auto px-4 py-8">
          <Link to="/artists" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Artists
          </Link>

          <div className="max-w-xl mx-auto">
            <Card className="border-primary/20">
              <CardHeader className="text-center">
                <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                  <Music className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Become an Artist</CardTitle>
                <CardDescription>
                  Share your music with the world. Create your artist profile to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="artistName">Artist Name *</Label>
                  <Input
                    id="artistName"
                    placeholder="Your artist/band name"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button onClick={handleRegister} disabled={registering} className="w-full">
                  {registering ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Profile...
                    </>
                  ) : (
                    "Create Artist Profile"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Already registered - show dashboard
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Artist Dashboard" 
        canonicalPath="/become-artist"
        description="Manage your music releases, track uploads, and albums on the NYRA artist dashboard."
      />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/artists" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Artists
            </Link>
            <h1 className="text-3xl font-bold text-foreground">Artist Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {myArtistProfile.artist_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/artist/${myArtistProfile.id}`}>
              <Button variant="outline">View Public Profile</Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <UserX className="h-4 w-4 mr-2" />
                  Delete Profile
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Artist Profile</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete your artist profile? This will permanently delete all your albums and songs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      setDeletingProfile(true);
                      const success = await deleteArtistProfile();
                      setDeletingProfile(false);
                      if (success) {
                        navigate('/artists');
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Delete Everything"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="albums" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="albums" className="gap-2">
              <Disc className="h-4 w-4" />
              Albums
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Song
            </TabsTrigger>
          </TabsList>

          <TabsContent value="albums" className="space-y-6">
            {/* Create Album */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New Album
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="albumName">Album Name *</Label>
                    <Input
                      id="albumName"
                      placeholder="Album title"
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="albumCover">Cover Image</Label>
                    <Input
                      id="albumCover"
                      type="file"
                      accept="image/*"
                      ref={albumCoverRef}
                      onChange={(e) => setAlbumCover(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateAlbum} disabled={creatingAlbum}>
                  {creatingAlbum ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Album
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Existing Albums */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myAlbums.map((album) => (
                <Card key={album.id} className="overflow-hidden group">
                  <div className="aspect-square relative">
                    {album.cover_image_url ? (
                      <img
                        src={album.cover_image_url}
                        alt={album.album_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Image className="h-12 w-12 text-primary/30" />
                      </div>
                    )}
                    {/* Delete button overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="rounded-full"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Album</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{album.album_name}"? This will also delete all songs in this album. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                setDeletingAlbumId(album.id);
                                await deleteAlbum(album.id);
                                setDeletingAlbumId(null);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingAlbumId === album.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate">{album.album_name}</h3>
                    <p className="text-sm text-muted-foreground">Album</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {myAlbums.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Disc className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No albums yet. Create your first album above!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload a Song
                </CardTitle>
                <CardDescription>Add a new song to one of your albums</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myAlbums.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Create an album first before uploading songs</p>
                    <Button onClick={() => document.querySelector<HTMLButtonElement>('[value="albums"]')?.click()}>
                      Go to Albums
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Select Album *</Label>
                      <Select value={selectedAlbumId} onValueChange={setSelectedAlbumId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an album" />
                        </SelectTrigger>
                        <SelectContent>
                          {myAlbums.map((album) => (
                            <SelectItem key={album.id} value={album.id}>
                              {album.album_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="songTitle">Song Title *</Label>
                      <Input
                        id="songTitle"
                        placeholder="Song name"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="songDescription">Description (optional)</Label>
                      <Textarea
                        id="songDescription"
                        placeholder="About this song..."
                        value={songDescription}
                        onChange={(e) => setSongDescription(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="audioFile">Audio File *</Label>
                      <Input
                        id="audioFile"
                        type="file"
                        accept="audio/*"
                        ref={audioFileRef}
                        onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Supported formats: MP3, WAV, M4A, etc.
                      </p>
                    </div>

                    <Button onClick={handleUploadSong} disabled={uploadingSong} className="w-full">
                      {uploadingSong ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Song
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BecomeArtist;
