export type ImageLayout = 'wide' | 'full' | 'portrait' | 'square';

export interface PortfolioImage {
    src: string;
    thumb: string;
    title: string;
    category: string;
    year: string;
}

export interface CarouselImage {
    src: string;
    title: string;
    category: string;
}

export interface GalleryImage {
    src: string;
    title: string;
    category: string;
}

export interface ProjectImage {
    src: string;
    layout: ImageLayout;
}

export interface Project {
    title: string;
    description: string;
    year: string;
    location: string;
    images: ProjectImage[];
}

export interface PortfolioData {
    portfolio: PortfolioImage[];
    carousel: CarouselImage[];
    gallery: GalleryImage[];
    projects: Project[];
}

export type Language = 'en' | 'pt';

export type Translations = Record<string, string>;

export interface I18NData {
    en: Translations;
    pt: Translations;
}
