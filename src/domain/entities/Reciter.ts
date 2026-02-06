export interface Reciter {
    id: string;
    name: string;
    subfolder: string; // Used for API URL construction (e.g., 'ar.alafasy')
    cdnFolder: string; // EveryAyah CDN folder name (e.g., 'Alafasy_128kbps')
}

// EveryAyah available reciters: https://everyayah.com/data/
export const RECITERS: Reciter[] = [
    {
        id: 'alafasy',
        name: 'Mishary Rashid Alafasy',
        subfolder: 'ar.alafasy',
        cdnFolder: 'Alafasy_128kbps',
    },
    {
        id: 'abdulbasit',
        name: 'Abdul Basit (Murattal)',
        subfolder: 'ar.abdulbasit',
        cdnFolder: 'Abdul_Basit_Murattal_192kbps',
    },
    {
        id: 'abdulbasit_mujawwad',
        name: 'Abdul Basit (Mujawwad)',
        subfolder: 'ar.abdulbasit',
        cdnFolder: 'Abdul_Basit_Mujawwad_128kbps',
    },
    {
        id: 'minshawy',
        name: 'Mohamed Siddiq Al-Minshawi',
        subfolder: 'ar.minshawi',
        cdnFolder: 'Minshawy_Murattal_128kbps',
    },
    {
        id: 'minshawy_mujawwad',
        name: 'Al-Minshawi (Mujawwad)',
        subfolder: 'ar.minshawi',
        cdnFolder: 'Minshawy_Mujawwad_192kbps',
    },
    {
        id: 'husary',
        name: 'Mahmoud Khalil Al-Husary',
        subfolder: 'ar.husary',
        cdnFolder: 'Husary_128kbps',
    },
    {
        id: 'sudais',
        name: 'Abdurrahman As-Sudais',
        subfolder: 'ar.sudais',
        cdnFolder: 'Abdurrahmaan_As-Sudais_192kbps',
    },
    {
        id: 'shuraym',
        name: 'Saud Al-Shuraym',
        subfolder: 'ar.shuraym',
        cdnFolder: 'Saood_ash-Shuraym_128kbps',
    },
    {
        id: 'ghamadi',
        name: 'Saad Al-Ghamdi',
        subfolder: 'ar.ghamadi',
        cdnFolder: 'Ghamadi_40kbps',
    },
    {
        id: 'maher',
        name: 'Maher Al-Muaiqly',
        subfolder: 'ar.maher',
        cdnFolder: 'MaherAlMuaiqly128kbps',
    },
    {
        id: 'ajamy',
        name: 'Ahmed Al-Ajamy',
        subfolder: 'ar.ajamy',
        cdnFolder: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
    },
    {
        id: 'hudhaify',
        name: 'Ali Al-Hudhaify',
        subfolder: 'ar.hudhaify',
        cdnFolder: 'Hudhaify_128kbps',
    },
    {
        id: 'hussary_mujawwad',
        name: 'Al-Husary (Mujawwad)',
        subfolder: 'ar.husary',
        cdnFolder: 'Husary_128kbps_Mujawwad',
    },
    {
        id: 'alijaber',
        name: 'Ali Jaber',
        subfolder: 'ar.jaber',
        cdnFolder: 'Ali_Jaber_64kbps',
    },
];

export const DEFAULT_RECITER = RECITERS[0];

// Helper to get reciter by ID
export const getReciterById = (id: string): Reciter => {
    return RECITERS.find(r => r.id === id) || DEFAULT_RECITER;
};
