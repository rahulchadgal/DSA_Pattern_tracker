import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const resolveRoute = (pathname: string) => {
  if (pathname === '/profile' || pathname === '/companies') return 'companies';
  if (pathname === '/roulette') return 'roulette';
  return 'syllabus';
};

export const useAppRoute = () => {
  const navigate = useNavigate();
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname));

  useEffect(() => {
    const syncRouteFromLocation = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener('popstate', syncRouteFromLocation);
    return () => window.removeEventListener('popstate', syncRouteFromLocation);
  }, []);

  const goTo = useCallback((path: string) => {
    setRoute(resolveRoute(path));
    navigate(path);
  }, [navigate]);

  const isProfile = route === 'companies';
  const isRoulette = route === 'roulette';
  const isSyllabus = route === 'syllabus';

  return {
    isProfile,
    isRoulette,
    isSyllabus,
    goMain: () => goTo('/'),
    goProfile: () => goTo('/companies'),
    goSyllabus: () => goTo('/'),
    goRoulette: () => goTo('/roulette')
  };
};
