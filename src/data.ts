import type { PortfolioData } from './types';

export const DATA: PortfolioData = {
    portfolio: [
        {
            src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=60',
            title: 'Silent Morning',
            category: 'Portrait',
            year: '2026',
        },
        {
            src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=60',
            title: 'Urban Geometry',
            category: 'Architecture',
            year: '2025',
        },
        {
            src: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=60',
            title: 'Metamorphosis',
            category: 'Fashion',
            year: '2026',
        },
        {
            src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=400&q=60',
            title: 'Eternal Vow',
            category: 'Wedding',
            year: '2026',
        },
        {
            src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=60',
            title: 'Urban Stories',
            category: 'Street',
            year: '2025',
        },
        {
            src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200&q=80',
            thumb: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=60',
            title: 'Paper Dreams',
            category: 'Editorial',
            year: '2026',
        },
    ],

    carousel: [
        { src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80', title: 'Warmth', category: 'Portrait' },
        { src: 'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=900&q=80', title: 'Structure', category: 'Architecture' },
        { src: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80', title: 'Elegance', category: 'Fashion' },
        { src: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=900&q=80', title: 'Serenity', category: 'Portrait' },
        { src: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=900&q=80', title: 'Horizon', category: 'Landscape' },
        { src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80', title: 'Motion', category: 'Fashion' },
    ],

    gallery: [
        { src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&q=80', title: 'Silent Morning', category: 'Portrait' },
        { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1600&q=80', title: 'Inner Light', category: 'Portrait' },
        { src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&q=80', title: 'Urban Geometry', category: 'Architecture' },
        { src: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=80', title: 'Metamorphosis', category: 'Fashion' },
        { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600&q=80', title: 'Eternal Vow', category: 'Wedding' },
        { src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&q=80', title: 'Urban Stories', category: 'Street' },
        { src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=80', title: 'Paper Dreams', category: 'Editorial' },
        { src: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&q=80', title: 'In Motion', category: 'Fashion' },
    ],

    projects: [
        {
            title: 'THE HUMAN CONDITION',
            description: 'Portraits exploring identity, silence and everyday gestures.',
            year: '2026',
            location: 'São Paulo, Brazil',
            images: [
                { src: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1400&q=80', layout: 'wide' },
                { src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1400&q=80', layout: 'full' },
                { src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80', layout: 'portrait' },
                { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1400&q=80', layout: 'full' },
            ],
        },
        {
            title: 'URBAN GEOMETRY',
            description: 'Architecture and the rhythm of built spaces.',
            year: '2025',
            location: 'Multiple Cities',
            images: [
                { src: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&q=80', layout: 'wide' },
                { src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1400&q=80', layout: 'full' },
                { src: 'https://images.unsplash.com/photo-1448630360428-65456885c650?w=1400&q=80', layout: 'square' },
                { src: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=1400&q=80', layout: 'full' },
            ],
        },
        {
            title: 'ETERNAL VOW',
            description: 'Wedding stories told through light and intimacy.',
            year: '2026',
            location: 'São Paulo, Brazil',
            images: [
                { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1400&q=80', layout: 'wide' },
                { src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1400&q=80', layout: 'full' },
                { src: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80', layout: 'portrait' },
                { src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1400&q=80', layout: 'full' },
            ],
        },
    ],
};
