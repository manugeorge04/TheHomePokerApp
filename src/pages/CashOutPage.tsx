import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Session, SessionPlayer } from '../types';

export default function CashOutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [cashouts, setCashouts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (merge = false) => {
    if (!sessionId) return;
    const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!s) return;
    setSession(s as Session);
    setIsHost(s.host_id === user?.id);

    const { data: playerRows } = await supabase
      .from('session_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at');
    setPlayers((playerRows ?? []) as SessionPlayer[]);

    const { data: cashoutRows } = await supabase
      .from('cash_outs')
      .select('*')
      .eq('session_id', sessionId);

    const cashoutMap: Record<string, string> = {};
    const savedMap: Record<string, boolean> = {};
    for (const co of cashoutRows ?? []) {
      cashoutMap[co.session_player_id] = String(co.amount);
      savedMap[co.session_player_id] = true;
    }
    // On real-time refresh, merge saved cashouts without wiping unsaved in-progress inputs
    if (merge) {
      setCashouts((prev) => ({ ...prev, ...cashoutMap }));
    } else {
      setCashouts(cashoutMap);
    }
    setSaved(savedMap);
  }, [sessionId, user?.id]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`cashout:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_outs', filter: `session_id=eq.${sessionId}` }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, () => loadData(true))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData, sessionId]);

  async function saveCashout(player: SessionPlayer) {
    const amount = parseFloat(cashouts[player.id] ?? '0');
    if (isNaN(amount)) { setError('Enter a valid amount'); return; }
    setLoading(true);
    try {
      // Always compute total from buy_ins to avoid stale total_buyin values
      const { data: buyinRows } = await supabase
        .from('buy_ins')
        .select('amount')
        .eq('session_player_id', player.id);
      const trueTotalBuyin = (buyinRows ?? []).reduce((sum, b) => sum + Number(b.amount), 0) || Number(player.total_buyin);
      const result = amount - trueTotalBuyin;

      // Upsert cash_out record
      const existing = saved[player.id];
      if (existing) {
        await supabase
          .from('cash_outs')
          .update({ amount })
          .eq('session_id', sessionId)
          .eq('session_player_id', player.id);
      } else {
        await supabase.from('cash_outs').insert({
          session_id: sessionId,
          session_player_id: player.id,
          amount,
        });
      }
      await supabase
        .from('session_players')
        .update({ cashout: amount, result, total_buyin: trueTotalBuyin })
        .eq('id', player.id);

      setSaved((prev) => ({ ...prev, [player.id]: true }));
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  const canEdit = (p: SessionPlayer) => isHost || p.user_id === user?.id;

  return (
    <Box sx={{ pb: 10 }}>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(`/session/${sessionId}`)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={700}>Cash Out</Typography>
            <Typography variant="caption" color="text.secondary">{session?.title}</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ px: 2, pt: 2, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter each player's cash-out amount. Results are calculated automagically.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {players.map((player) => {
            const cashout = parseFloat(cashouts[player.id] ?? '');
            const result = isNaN(cashout) ? null : cashout - Number(player.total_buyin);
            const editable = canEdit(player);

            return (
              <Card
                key={player.id}
                sx={{
                  border: saved[player.id]
                    ? '1px solid rgba(74,222,128,0.3)'
                    : '1px solid rgba(74,222,128,0.1)',
                }}
              >
                <CardContent sx={{ py: 2, px: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.dark', width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700 }}>
                      {player.display_name[0].toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>{player.display_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Bought in: ${Number(player.total_buyin).toFixed(0)}
                      </Typography>
                    </Box>
                    {saved[player.id] && <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />}
                  </Box>

                  {editable ? (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField
                        label="Cash Out"
                        type="number"
                        size="small"
                        value={cashouts[player.id] ?? ''}
                        onChange={(e) => setCashouts((prev) => ({ ...prev, [player.id]: e.target.value }))}
                        inputProps={{ min: 0, step: 5 }}
                        sx={{ flex: 1 }}
                        InputProps={{
                          startAdornment: <AttachMoneyIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 18 }} />,
                        }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => saveCashout(player)}
                        disabled={loading || !cashouts[player.id]}
                        sx={{ height: 40, minWidth: 64 }}
                      >
                        Save
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {saved[player.id] ? `Cash out: $${Number(player.cashout).toFixed(0)}` : 'Awaiting cash-out...'}
                    </Typography>
                  )}

                  {result !== null && saved[player.id] && (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ color: result >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {result >= 0 
                          ? `${result.toFixed(2)} profit` 
                          : `${Math.abs(result).toFixed(2)} loss`
                        }
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {isHost && players.length > 0 && (
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            size="large"
            sx={{ mt: 3, py: 1.8, fontSize: '1rem' }}
            onClick={() => navigate(`/session/${sessionId}/summary`)}
          >
            View Session Summary
          </Button>
        )}
      </Box>
    </Box>
  );
}
