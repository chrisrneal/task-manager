import { 
  validateFieldValueType, 
  isValidFieldInputType, 
  validateFieldName, 
  formatFieldValue 
} from '../utils/customFieldUtils';
import { Field } from '../types/database';

describe('Custom Field Utilities', () => {
  describe('validateFieldValueType', () => {
    test('should validate text field values', () => {
      const field: Field = {
        id: '1',
        name: 'Text Field',
        input_type: 'text',
        is_required: true,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validateFieldValueType(field, 'Valid text')).toBeNull();
      expect(validateFieldValueType(field, '')).toBe('Required field cannot be empty');
      expect(validateFieldValueType(field, null)).toBe('Required field cannot be empty');
    });

    test('should validate number field values', () => {
      const field: Field = {
        id: '1',
        name: 'Number Field',
        input_type: 'number',
        is_required: true,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validateFieldValueType(field, '123')).toBeNull();
      expect(validateFieldValueType(field, '123.45')).toBeNull();
      expect(validateFieldValueType(field, 'not a number')).toBe('Value must be a valid number');
      expect(validateFieldValueType(field, '')).toBe('Required field cannot be empty');
    });

    test('should validate date field values', () => {
      const field: Field = {
        id: '1',
        name: 'Date Field',
        input_type: 'date',
        is_required: true,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validateFieldValueType(field, '2024-01-01')).toBeNull();
      expect(validateFieldValueType(field, '2024-12-31T10:30:00Z')).toBeNull();
      expect(validateFieldValueType(field, 'invalid date')).toBe('Value must be a valid date');
      expect(validateFieldValueType(field, '')).toBe('Required field cannot be empty');
    });

    test('should validate checkbox field values', () => {
      const field: Field = {
        id: '1',
        name: 'Checkbox Field',
        input_type: 'checkbox',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validateFieldValueType(field, 'true')).toBeNull();
      expect(validateFieldValueType(field, 'false')).toBeNull();
      expect(validateFieldValueType(field, '1')).toBeNull();
      expect(validateFieldValueType(field, '0')).toBeNull();
      expect(validateFieldValueType(field, 'maybe')).toBe('Value must be true/false or 1/0');
      expect(validateFieldValueType(field, '')).toBeNull(); // Not required
    });

    test('should handle non-required fields with empty values', () => {
      const field: Field = {
        id: '1',
        name: 'Optional Field',
        input_type: 'text',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(validateFieldValueType(field, '')).toBeNull();
      expect(validateFieldValueType(field, null)).toBeNull();
      expect(validateFieldValueType(field, 'Some value')).toBeNull();
    });
  });

  describe('isValidFieldInputType', () => {
    test('should validate field input types', () => {
      expect(isValidFieldInputType('text')).toBe(true);
      expect(isValidFieldInputType('textarea')).toBe(true);
      expect(isValidFieldInputType('number')).toBe(true);
      expect(isValidFieldInputType('date')).toBe(true);
      expect(isValidFieldInputType('select')).toBe(true);
      expect(isValidFieldInputType('checkbox')).toBe(true);
      expect(isValidFieldInputType('radio')).toBe(true);
      
      expect(isValidFieldInputType('invalid')).toBe(false);
      expect(isValidFieldInputType('')).toBe(false);
      expect(isValidFieldInputType('email')).toBe(false);
    });
  });

  describe('validateFieldName', () => {
    test('should validate field names', () => {
      expect(validateFieldName('Valid Field Name')).toBeNull();
      expect(validateFieldName('Field_123')).toBeNull();
      expect(validateFieldName('Field-Name (test)')).toBeNull();
      
      expect(validateFieldName('')).toBe('Field name cannot be empty');
      expect(validateFieldName('   ')).toBe('Field name cannot be empty');
      expect(validateFieldName('a'.repeat(101))).toBe('Field name cannot exceed 100 characters');
      expect(validateFieldName('Field@Name')).toBe('Field name contains invalid characters');
      expect(validateFieldName('Field$Name')).toBe('Field name contains invalid characters');
    });

    test('should handle null and undefined names', () => {
      expect(validateFieldName(null as any)).toBe('Field name is required');
      expect(validateFieldName(undefined as any)).toBe('Field name is required');
      expect(validateFieldName(123 as any)).toBe('Field name is required');
    });
  });

  describe('formatFieldValue', () => {
    test('should format checkbox values', () => {
      const field: Field = {
        id: '1',
        name: 'Checkbox',
        input_type: 'checkbox',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(formatFieldValue(field, 'true')).toBe('Yes');
      expect(formatFieldValue(field, '1')).toBe('Yes');
      expect(formatFieldValue(field, 'false')).toBe('No');
      expect(formatFieldValue(field, '0')).toBe('No');
      expect(formatFieldValue(field, null)).toBe('');
    });

    test('should format date values', () => {
      const field: Field = {
        id: '1',
        name: 'Date',
        input_type: 'date',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const testDate = '2024-01-15';
      const formatted = formatFieldValue(field, testDate);
      expect(formatted).toMatch(/1\/15\/2024|15\/1\/2024|2024-01-15/); // Different locale formats
      expect(formatFieldValue(field, 'invalid')).toBe('invalid');
      expect(formatFieldValue(field, null)).toBe('');
    });

    test('should format number values', () => {
      const field: Field = {
        id: '1',
        name: 'Number',
        input_type: 'number',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(formatFieldValue(field, '1234')).toBe('1,234');
      expect(formatFieldValue(field, '1234.56')).toBe('1,234.56');
      expect(formatFieldValue(field, 'not a number')).toBe('not a number');
      expect(formatFieldValue(field, null)).toBe('');
    });

    test('should format text values as-is', () => {
      const field: Field = {
        id: '1',
        name: 'Text',
        input_type: 'text',
        is_required: false,
        project_id: 'proj1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(formatFieldValue(field, 'Simple text')).toBe('Simple text');
      expect(formatFieldValue(field, null)).toBe('');
    });
  });
});
