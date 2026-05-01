// apps/web/components/workspaces/WorkspaceSkillsManager.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@kletron/ui/button';
import { Card } from '@kletron/ui/card';
import { Checkbox } from '@kletron/ui/checkbox';
import { Label } from '@kletron/ui/label';
import { Badge } from '@kletron/ui/badge';

interface WorkspaceSkillsManagerProps {
  workspaceId: string;
  currentSkills?: any;
  onSave?: () => void;
}

export function WorkspaceSkillsManager({ workspaceId, currentSkills = {}, onSave }: WorkspaceSkillsManagerProps) {
  const [skillsConfig, setSkillsConfig] = useState(currentSkills);
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Available skills (in a real app, this would come from an API)
  const allAvailableSkills = [
    'research',
    'github_integration',
    'terminal_access',
    'file_editing',
    'web_search'
  ];

  useEffect(() => {
    // Load available skills
    setAvailableSkills(allAvailableSkills);
  }, []);

  const handleToggleSkill = async (skillId: string) => {
    try {
      setLoading(true);
      
      const currentSkillsList = skillsConfig.skills || [];
      let newSkillsList;
      
      if (currentSkillsList.includes(skillId)) {
        // Disable skill
        newSkillsList = currentSkillsList.filter(id => id !== skillId);
        const response = await fetch(`/api/workspaces/${workspaceId}/skills/disable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId })
        });
      } else {
        // Enable skill
        newSkillsList = [...currentSkillsList, skillId];
        const response = await fetch(`/api/workspaces/${workspaceId}/skills/enable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId })
        });
      }
      
      setSkillsConfig(prev => ({
        ...prev,
        skills: newSkillsList
      }));
    } catch (error) {
      console.error('Error toggling workspace skill:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillsConfig)
      });
      
      if (response.ok && onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving workspace skills:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Workspace Skills</h3>
        <Button onClick={handleSave} disabled={loading}>
          Save Configuration
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Enable or disable skills for this workspace. Skills control which tools and capabilities are available.
      </p>

      <div className="space-y-4">
        {availableSkills.map((skill) => {
          const isEnabled = (skillsConfig.skills || []).includes(skill);

          return (
            <Card key={skill} className="p-4 border-dashed flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`skill-${skill}`}
                  checked={isEnabled}
                  onCheckedChange={() => handleToggleSkill(skill)}
                />
                <Label htmlFor={`skill-${skill}`} className="font-medium capitalize">
                  {skill.replace('_', ' ')}
                </Label>
              </div>

              <Badge variant="secondary" className="text-xs">
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

// Helper component to display current workspace skills
interface WorkspaceSkillsDisplayProps {
  workspaceId: string;
  skills?: any;
}

export function WorkspaceSkillsDisplay({ workspaceId, skills = {} }: WorkspaceSkillsDisplayProps) {
  const enabledSkills = (skills.skills || []).map(skill => (
    <Badge key={skill} variant="secondary" className="text-xs mr-2 mb-2">
      {skill.replace('_', ' ')}
    </Badge>
  ));

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Enabled Skills:</h4>
      <div className="flex flex-wrap gap-2">
        {enabledSkills.length > 0 ? enabledSkills : <span className="text-sm text-muted-foreground">No skills enabled</span>}
      </div>
    </div>
  );
}