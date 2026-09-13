import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

export default function LanguageSelection() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  useEffect(() => {
    if (!id) return;
    navigate(`/survey/${id}/welcome${location.search}`, { replace: true });
  }, [id, location.search, navigate]);

  return null;
}
