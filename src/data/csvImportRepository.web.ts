import AsyncStorage from '@react-native-async-storage/async-storage';
import { exerciseCatalog } from './exerciseCatalog';
import { queueWebWrite, registerWebRecovery } from './webWriteQueue';
import { recoverCsvImport, writeCsvImport, parseCsvMappings } from './csvImport/webStorage';
import type { CsvImportRequest, CsvMappings } from './csvImport/types';

registerWebRecovery(() => recoverCsvImport(AsyncStorage));
export function loadCsvMappings(): Promise<CsvMappings> {
  return queueWebWrite(async () =>
    parseCsvMappings(await AsyncStorage.getItem('@forge/csv-exercise-mappings-v1')),
  );
}
export function commitCsvImport(request: CsvImportRequest) {
  return queueWebWrite(() => writeCsvImport(AsyncStorage, request, exerciseCatalog));
}
