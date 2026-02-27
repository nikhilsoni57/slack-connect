import { Router, Request, Response } from 'express';
import { serviceNowClient } from '../services/servicenow.js';
import { 
  ServiceNowIncidentCreateRequest,
  ServiceNowIncidentUpdateRequest,
  ServiceNowQueryParams,
  ApiResponse
} from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Middleware to check ServiceNow authentication
 */
const requireServiceNowAuth = async (req: Request, res: Response, next: any) => {
  // Check session authentication first
  if (req.session?.servicenow_authenticated) {
    return next();
  }
  
  // Fallback: check if ServiceNow client has valid tokens (for testing)
  try {
    const status = await serviceNowClient.getConnectionStatus();
    if (status.success && status.data?.authenticated) {
      logger.info('Using ServiceNow client tokens for authentication (session not available)');
      return next();
    }
  } catch (error) {
    logger.error('ServiceNow client authentication check failed:', error);
  }
  
  return res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'ServiceNow authentication required for incident operations'
  });
};

/**
 * POST /incidents
 * Create a new ServiceNow incident
 */
router.post('/', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const incidentData: ServiceNowIncidentCreateRequest = req.body;
    
    // Validate required fields
    if (!incidentData.short_description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field',
        message: 'short_description is required for incident creation'
      });
    }
    
    // Set default values if not provided
    const incident: ServiceNowIncidentCreateRequest = {
      urgency: '3', // Medium
      impact: '3', // Medium  
      priority: '3', // Medium
      ...incidentData
    };
    
    logger.info('Creating ServiceNow incident', {
      short_description: incident.short_description,
      urgency: incident.urgency,
      impact: incident.impact,
      priority: incident.priority
    });
    
    const result = await serviceNowClient.createIncident(incident);
    const statusCode = result.success ? 201 : 400;
    
    res.status(statusCode).json(result);
    
  } catch (error: any) {
    logger.error('Incident creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident creation failed',
      message: error.message || 'Unable to create incident'
    });
  }
});

/**
 * GET /incidents
 * Get list of ServiceNow incidents with optional filtering
 */
router.get('/', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const {
      limit = 50,
      offset = 0,
      state,
      priority,
      assigned_to,
      caller_id,
      created_since,
      query,
      fields
    } = req.query;
    
    // Build query parameters
    const queryParams: ServiceNowQueryParams = {
      sysparm_limit: Math.min(parseInt(limit as string) || 50, 1000), // Max 1000
      sysparm_offset: parseInt(offset as string) || 0,
      sysparm_display_value: 'all',
      sysparm_exclude_reference_link: false
    };
    
    // Add field selection if specified
    if (fields) {
      queryParams.sysparm_fields = fields as string;
    }
    
    // Build filter query
    const filters: string[] = [];
    
    if (state) {
      filters.push(`state=${state}`);
    }
    
    if (priority) {
      filters.push(`priority=${priority}`);
    }
    
    if (assigned_to) {
      filters.push(`assigned_to=${assigned_to}`);
    }
    
    if (caller_id) {
      filters.push(`caller_id=${caller_id}`);
    }
    
    if (created_since) {
      // Format: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
      filters.push(`sys_created_on>=${created_since}`);
    }
    
    // Add custom query if provided
    if (query) {
      filters.push(query as string);
    }
    
    // Combine filters with AND operator
    if (filters.length > 0) {
      queryParams.sysparm_query = filters.join('^');
    }
    
    logger.info('Retrieving ServiceNow incidents', {
      limit: queryParams.sysparm_limit,
      offset: queryParams.sysparm_offset,
      query: queryParams.sysparm_query
    });
    
    const result = await serviceNowClient.getIncidents(queryParams);
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('Incident retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident retrieval failed',
      message: error.message || 'Unable to retrieve incidents'
    });
  }
});

/**
 * GET /incidents/:id
 * Get a specific ServiceNow incident by sys_id
 */
router.get('/:id', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || id.length !== 32) {
      return res.status(400).json({
        success: false,
        error: 'Invalid incident ID',
        message: 'Incident ID must be a valid 32-character sys_id'
      });
    }
    
    logger.info(`Retrieving ServiceNow incident: ${id}`);
    
    const result = await serviceNowClient.getIncident(id);
    const statusCode = result.success ? 200 : 404;
    
    res.status(statusCode).json(result);
    
  } catch (error: any) {
    logger.error('Incident retrieval failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident retrieval failed',
      message: error.message || 'Unable to retrieve incident'
    });
  }
});

/**
 * PUT /incidents/:id
 * Update a ServiceNow incident
 */
router.put('/:id', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: ServiceNowIncidentUpdateRequest = req.body;
    
    if (!id || id.length !== 32) {
      return res.status(400).json({
        success: false,
        error: 'Invalid incident ID',
        message: 'Incident ID must be a valid 32-character sys_id'
      });
    }
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No update data provided',
        message: 'At least one field must be provided for update'
      });
    }
    
    logger.info(`Updating ServiceNow incident: ${id}`, {
      fields: Object.keys(updateData)
    });
    
    const result = await serviceNowClient.updateIncident(id, updateData);
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('Incident update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident update failed',
      message: error.message || 'Unable to update incident'
    });
  }
});

/**
 * GET /incidents/stats/summary
 * Get incident statistics summary
 */
router.get('/stats/summary', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    logger.info('Generating incident statistics summary');
    
    // Get various incident counts in parallel
    const [
      activeResult,
      criticalResult, 
      highResult,
      newResult,
      myAssignedResult
    ] = await Promise.allSettled([
      serviceNowClient.getIncidents({ sysparm_query: 'active=true', sysparm_limit: 1000 }),
      serviceNowClient.getIncidents({ sysparm_query: 'priority=1^active=true', sysparm_limit: 1000 }),
      serviceNowClient.getIncidents({ sysparm_query: 'priority=2^active=true', sysparm_limit: 1000 }),
      serviceNowClient.getIncidents({ sysparm_query: 'state=1', sysparm_limit: 1000 }),
      serviceNowClient.getIncidents({ sysparm_query: `assigned_to=${req.session?.user_id || ''}^active=true`, sysparm_limit: 1000 })
    ]);
    
    const stats = {
      total_active: activeResult.status === 'fulfilled' && activeResult.value.success ? activeResult.value.data?.length || 0 : 0,
      critical: criticalResult.status === 'fulfilled' && criticalResult.value.success ? criticalResult.value.data?.length || 0 : 0,
      high_priority: highResult.status === 'fulfilled' && highResult.value.success ? highResult.value.data?.length || 0 : 0,
      new_incidents: newResult.status === 'fulfilled' && newResult.value.success ? newResult.value.data?.length || 0 : 0,
      assigned_to_me: myAssignedResult.status === 'fulfilled' && myAssignedResult.value.success ? myAssignedResult.value.data?.length || 0 : 0,
      last_updated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats,
      message: 'Incident statistics retrieved successfully'
    });
    
  } catch (error: any) {
    logger.error('Failed to generate incident statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Statistics generation failed',
      message: error.message || 'Unable to generate incident statistics'
    });
  }
});

/**
 * POST /incidents/:id/resolve
 * Convenience endpoint to resolve an incident
 */
router.post('/:id/resolve', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;
    
    if (!id || id.length !== 32) {
      return res.status(400).json({
        success: false,
        error: 'Invalid incident ID',
        message: 'Incident ID must be a valid 32-character sys_id'
      });
    }
    
    const updateData: ServiceNowIncidentUpdateRequest = {
      state: '6', // Resolved
      resolution_notes: resolution_notes || 'Incident resolved via Nexecute Connect'
    };
    
    logger.info(`Resolving ServiceNow incident: ${id}`);
    
    const result = await serviceNowClient.updateIncident(id, updateData);
    
    if (result.success) {
      result.message = `Incident ${result.data?.number} resolved successfully`;
    }
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('Incident resolution failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident resolution failed',
      message: error.message || 'Unable to resolve incident'
    });
  }
});

/**
 * POST /incidents/:id/assign
 * Convenience endpoint to assign an incident
 */
router.post('/:id/assign', requireServiceNowAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assigned_to, assignment_group, work_notes } = req.body;
    
    if (!id || id.length !== 32) {
      return res.status(400).json({
        success: false,
        error: 'Invalid incident ID',
        message: 'Incident ID must be a valid 32-character sys_id'
      });
    }
    
    if (!assigned_to && !assignment_group) {
      return res.status(400).json({
        success: false,
        error: 'Assignment target required',
        message: 'Either assigned_to or assignment_group must be provided'
      });
    }
    
    const updateData: ServiceNowIncidentUpdateRequest = {
      state: '2' // In Progress
    };
    
    if (assigned_to) {
      updateData.assigned_to = assigned_to;
    }
    
    if (assignment_group) {
      updateData.assignment_group = assignment_group;
    }
    
    if (work_notes) {
      updateData.work_notes = work_notes;
    }
    
    logger.info(`Assigning ServiceNow incident: ${id}`, {
      assigned_to,
      assignment_group
    });
    
    const result = await serviceNowClient.updateIncident(id, updateData);
    
    if (result.success) {
      result.message = `Incident ${result.data?.number} assigned successfully`;
    }
    
    res.json(result);
    
  } catch (error: any) {
    logger.error('Incident assignment failed:', error);
    res.status(500).json({
      success: false,
      error: 'Incident assignment failed',
      message: error.message || 'Unable to assign incident'
    });
  }
});

export { router as incidentRoutes };