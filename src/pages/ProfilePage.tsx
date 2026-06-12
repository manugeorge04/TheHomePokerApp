import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [preferredBuyin, setPreferredBuyin] = useState('20');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setUsername(profile.username ?? '');
      setPreferredBuyin(String(profile.preferred_buyin ?? 20));
    }
  }, [profile]);

  async function handleSave() {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          username: username.trim() || null,
          preferred_buyin: parseInt(preferredBuyin) || 20,
        })
        .eq('id', user!.id);
      if (err) throw err;
      await refreshProfile();
      setEditing(false);
      setSuccess('Profile updated!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }} elevation={0}>
        <Toolbar>
          <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700}>Profile</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 3, maxWidth: 500, mx: 'auto' }}>
        {/* Avatar + Name */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Avatar
            sx={{
              width: 80, height: 80, mx: 'auto', mb: 1.5,
              fontSize: '2rem', fontWeight: 800,
              background: 'linear-gradient(135deg, #4ade80, #16a34a)',
              color: '#080d08',
            }}
          >
            {(profile?.display_name ?? 'P')[0].toUpperCase()}
          </Avatar>
          <Typography variant="h5" fontWeight={800}>{profile?.display_name ?? '...'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Member since {profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
          </Typography>
        </Box>

        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700}>Profile Details</Typography>
              {!editing ? (
                <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
              ) : (
                <Button size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={loading} variant="contained">
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!editing}
                fullWidth
                size="small"
              />
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!editing}
                fullWidth
                size="small"
                helperText={editing ? 'Shown on leaderboards' : ''}
              />
              <TextField
                label="Default Buy-In ($)"
                type="number"
                value={preferredBuyin}
                onChange={(e) => setPreferredBuyin(e.target.value)}
                disabled={!editing}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 5 }}
                helperText={editing ? 'Pre-filled when joining sessions' : ''}
              />
            </Box>

            {editing && (
              <Button onClick={() => setEditing(false)} fullWidth sx={{ mt: 2 }} color="inherit">
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>

        <Divider sx={{ my: 2 }} />

        <Button
          variant="outlined"
          color="error"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={signOut}
          sx={{ py: 1.5 }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
