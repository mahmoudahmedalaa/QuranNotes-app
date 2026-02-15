/**
 * Mood illustration image mapping.
 * Maps each MoodType to its corresponding illustration asset.
 *
 * These are abstract watercolor illustrations (no emojis/faces)
 * with a meditative, Headspace-like aesthetic.
 */
import { ImageSourcePropType } from 'react-native';
import { MoodType } from '../../domain/entities/Mood';

export const MOOD_ILLUSTRATIONS: Record<MoodType, ImageSourcePropType> = {
    grateful: require('../../../assets/mood-icons/grateful.png'),
    anxious: require('../../../assets/mood-icons/anxious.png'),
    sad: require('../../../assets/mood-icons/sad.png'),
    hopeful: require('../../../assets/mood-icons/hopeful.png'),
    strong: require('../../../assets/mood-icons/strong.png'),
    frustrated: require('../../../assets/mood-icons/frustrated.png'),
    lost: require('../../../assets/mood-icons/lost.png'),
    heartbroken: require('../../../assets/mood-icons/heartbroken.png'),
    confused: require('../../../assets/mood-icons/confused.png'),
    peaceful: require('../../../assets/mood-icons/peaceful.png'),
    lonely: require('../../../assets/mood-icons/lonely.png'),
    inspired: require('../../../assets/mood-icons/inspired.png'),
};
