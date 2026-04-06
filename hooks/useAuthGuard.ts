import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const useAuthGuard = (roles: string[] = []) => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (userRole && roles.length > 0 && !roles.includes(userRole)) {
      switch (userRole) {
        case 'admin':
        case 'instructor':
          navigate('/admin', { replace: true });
          break;
        default:
          navigate('/dashboard', { replace: true });
          break;
      }
    }
  }, [user, userRole, loading, navigate, roles]);

  const isAllowed = !loading && !!user && (roles.length === 0 || (!!userRole && roles.includes(userRole)));

  return isAllowed;
};

export default useAuthGuard;