import { useEffect, useState } from 'react';
import { findNodeHandle } from 'react-native';
export const useRefHandle = compRef => {
  const [handle, setHandle] = useState();
  useEffect(() => {
    if (compRef.current) {
      const reactTag = findNodeHandle(compRef.current);
      setHandle(reactTag || undefined);
    }
  }, [compRef]);
  return handle;
};
//# sourceMappingURL=useRefHandle.js.map