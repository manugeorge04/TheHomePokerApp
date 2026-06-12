import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import PersonIcon from '@mui/icons-material/Person';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Home', icon: <HomeIcon />, path: '/' },
    { label: 'Stats', icon: <BarChartIcon />, path: '/stats' },
    { label: 'Leaders', icon: <LeaderboardIcon />, path: '/leaderboard' },
    { label: 'Profile', icon: <PersonIcon />, path: '/profile' },
  ];

  const currentNav = navItems.findIndex((item) => location.pathname === item.path);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', pb: '64px' }}>
      <Box sx={{ flex: 1, overflow: 'auto' }}>{children}</Box>
      <BottomNavigation
        value={currentNav === -1 ? false : currentNav}
        onChange={(_, val: number) => navigate(navItems[val].path)}
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 'appBar' }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
