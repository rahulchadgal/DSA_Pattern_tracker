import { useLocation, useNavigate } from 'react-router-dom';

export const useAppRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isProfile = location.pathname === '/profile' || location.pathname === '/companies';
  const isRoulette = location.pathname === '/roulette';
  const isSyllabus = !isProfile && !isRoulette;

  return {
    isProfile,
    isRoulette,
    isSyllabus,
    goMain: () => navigate('/'),
    goProfile: () => navigate('/companies'),
    goSyllabus: () => navigate('/'),
    goRoulette: () => navigate('/roulette')
  };
};
