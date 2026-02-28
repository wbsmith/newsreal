import { StoryBiasTag } from '@/types';

interface BiasTagProps {
  tag: StoryBiasTag;
}

export default function BiasTag({ tag }: BiasTagProps) {
  return <span className={`bias-tag ${tag.class}`}>{tag.label}</span>;
}
