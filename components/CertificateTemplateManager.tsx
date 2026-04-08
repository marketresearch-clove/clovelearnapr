import React, { useState, useEffect } from 'react';
import { 
  getAllTemplates, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate,
  CertificateTemplate,
  PlaceholderConfig
} from '../lib/certificateTemplateService';
import CertificateTemplateEditor from './CertificateTemplateEditor';
import Loader from './Loader';

interface TemplateManagerProps {
  onTemplateUpdated?: (template: CertificateTemplate) => void;
  readOnly?: boolean;
}

const CertificateTemplateManager: React.FC<TemplateManagerProps> = ({
  onTemplateUpdated,
  readOnly = false,
}) => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      setErrorMessage('Failed to load certificate templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    try {
      const template = await createTemplate({
        template_name: newTemplateName,
        background_image_url: '', // Will be uploaded in editor
        placeholder_config: [],
        is_active: templates.length === 0, // Make first template active by default
        display_order: templates.length,
        width: 3125,
        height: 2209,
      });
      
      setTemplates([...templates, template]);
      setEditingTemplate(template);
      setIsCreating(false);
      setNewTemplateName('');
      setSuccessMessage('Template created successfully');
    } catch (error) {
      console.error('Error creating template:', error);
      setErrorMessage('Failed to create template');
    }
  };

  const handleSaveTemplateConfig = async (config: PlaceholderConfig[], imageUrl: string, width: number, height: number) => {
    if (!editingTemplate) return;

    try {
      const updated = await updateTemplate({
        id: editingTemplate.id,
        placeholder_config: config,
        background_image_url: imageUrl,
        width,
        height,
      });

      setTemplates(templates.map(t => t.id === updated.id ? updated : t));
      setEditingTemplate(null);
      setSuccessMessage('Template configuration saved successfully');
      if (onTemplateUpdated) onTemplateUpdated(updated);
    } catch (error) {
      console.error('Error saving template config:', error);
      setErrorMessage('Failed to save template configuration');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
      setSuccessMessage('Template deleted successfully');
    } catch (error) {
      console.error('Error deleting template:', error);
      setErrorMessage('Failed to delete template');
    }
  };

  const handleToggleActive = async (template: CertificateTemplate) => {
    try {
      const updated = await updateTemplate({
        id: template.id,
        is_active: !template.is_active,
      });
      setTemplates(templates.map(t => t.id === updated.id ? updated : t));
      setSuccessMessage(`Template ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling template status:', error);
      setErrorMessage('Failed to update template status');
    }
  };

  if (editingTemplate) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <CertificateTemplateEditor
          templateName={editingTemplate.template_name}
          initialConfig={editingTemplate.placeholder_config || []}
          backgroundImageUrl={editingTemplate.background_image_url}
          width={editingTemplate.width || 3125}
          height={editingTemplate.height || 2209}
          onSave={handleSaveTemplateConfig}
          onCancel={() => setEditingTemplate(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Certificate Templates</h2>
        {!readOnly && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            New Template
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>
            <span className="material-symbols-rounded text-sm">close</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')}>
            <span className="material-symbols-rounded text-sm">close</span>
          </button>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Create New Template</h3>
            <form onSubmit={handleCreateTemplate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Summer Course 2026"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Create & Open Editor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div 
              key={template.id} 
              className={`bg-white rounded-xl shadow-sm border transition-all overflow-hidden flex flex-col ${
                template.is_active ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'
              }`}
            >
              <div className="aspect-[1.4/1] bg-gray-100 relative group">
                {template.background_image_url ? (
                  <img 
                    src={template.background_image_url} 
                    alt={template.template_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="material-symbols-rounded text-4xl mb-2">image</span>
                    <span className="text-xs">No background image</span>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    onClick={() => setEditingTemplate(template)}
                    className="p-2 bg-white rounded-full text-gray-900 hover:bg-primary hover:text-white transition-colors"
                    title="Edit Template"
                  >
                    <span className="material-symbols-rounded">edit</span>
                  </button>
                </div>

                {template.is_active && (
                  <div className="absolute top-3 right-3 bg-primary text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    Active
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 mb-1">{template.template_name}</h3>
                <p className="text-xs text-gray-500 mb-4 flex-1">
                  {template.placeholder_config?.length || 0} placeholders mapped
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                        template.is_active 
                          ? 'text-gray-400 hover:text-gray-600' 
                          : 'text-primary hover:bg-primary/10'
                      }`}
                    >
                      {template.is_active ? 'Deactivate' : 'Set as Active'}
                    </button>
                  </div>
                  
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Delete Template"
                    >
                      <span className="material-symbols-rounded text-sm">delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <span className="material-symbols-rounded text-gray-300 text-5xl mb-3">description</span>
              <p className="text-gray-500">No templates found. Create your first image-based template.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CertificateTemplateManager;
