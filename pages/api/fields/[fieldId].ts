import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { fieldId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/fields/${fieldId} - Request received`);

  // Extract user token from request
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Create a Supabase client with the user's token for RLS
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `****** } }
  });

  // Verify the user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    // Handle GET request - Get a single field
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found',
            traceId
          });
        }
        throw error;
      }
      
      console.log(`[${traceId}] GET /api/fields/${fieldId} - Success`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle PUT request - Update a field
    if (method === 'PUT') {
      const { name, input_type, is_required } = req.body;
      
      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Name is required',
          traceId
        });
      }

      // First check if field exists and belongs to user's project
      const { data: existingField, error: findError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found or access denied - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      const updatePayload = {
        name,
        input_type: input_type || existingField.input_type,
        is_required: is_required !== undefined ? is_required : existingField.is_required,
        updated_at: new Date().toISOString()
      };
      
      console.log(`[${traceId}] Update payload:`, updatePayload);

      const { data, error } = await supabase
        .from('fields')
        .update(updatePayload)
        .eq('id', fieldId)
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error updating field: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] PUT /api/fields/${fieldId} - Success`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle DELETE request - Delete a field
    if (method === 'DELETE') {
      // First check if field exists and belongs to user's project
      const { data: existingField, error: findError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found or access denied - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      // Delete the field
      const { error } = await supabase
        .from('fields')
        .delete()
        .eq('id', fieldId);

      if (error) {
        console.error(`[${traceId}] Error deleting field: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] DELETE /api/fields/${fieldId} - Success`);
      return res.status(200).json({ 
        message: 'Field deleted successfully', 
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;