export const convertYouTubeUrl = (url: string): string => {
  if (!url) return '';

  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/)?([a-zA-Z0-9_-]{11})/;

  const match = url.match(youtubeRegex);

  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  return url;
};

export const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/.test(url);
};
