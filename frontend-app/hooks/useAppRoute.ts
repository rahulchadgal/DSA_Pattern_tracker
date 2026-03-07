import { useLocation, useNavigate } from 'react-router-dom';

export const useAppRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isProfile = location.pathname === '/profile';
  const isRoulette = location.pathname === '/roulette';
  const isSyllabus = !isProfile && !isRoulette;

  return {
    isProfile,
    isRoulette,
    isSyllabus,
    goMain: () => navigate('/'),
    goProfile: () => navigate('/profile'),
    goSyllabus: () => navigate('/'),
    goRoulette: () => navigate('/roulette')
  };
};
