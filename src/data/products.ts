import rawProducts from './products.json';

export interface Product {
  id: string;
  sku: string;
  fsn?: string;
  title: string;
  category: 'Learning Toys' | 'Musical Toys' | 'Puzzles' | 'Sensory & Activity' | 'STEM & Creative';
  mrp: number;
  price: number;
  minAge: number;
  ageText: string;
  rating: number;
  reviewsCount: number;
  images: string[];
  bulletFeatures: string[];
  description: string;
  inStock: boolean;
  isFeatured?: boolean;
}

export const products: Product[] = rawProducts as Product[];

export const CATEGORIES = [
  'All',
  'Learning Toys',
  'Musical Toys',
  'Puzzles',
  'Sensory & Activity',
  'STEM & Creative',
] as const;

export type Category = (typeof CATEGORIES)[number];
