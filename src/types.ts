export interface Anime {
  id: string;
  titleZh: string;
  coverImage: string;
  yearSeason: string;
  genres: string[];
}

export interface WatchedAnime extends Anime {
  userRating: number;
  userComment: string;
  watchedDate: string;
}

export type SortOption = 'date_desc' | 'date_asc' | 'rating_desc' | 'rating_asc';
