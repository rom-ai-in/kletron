"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { Plus, Edit, Trash2, Settings, Play } from "lucide-react";
import { Switch } from "@kletron/ui/components/ui/Toggle";
import { Modal as Dialog, ModalProps as DialogProps } from "@kletron/ui/components/ui/Modal";

interface Skill {
  id: string;
  name: string;
  description: string;
  filePath: string;
  enabled: boolean;
}

export default function SkillsConfig() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null);
  const [skillContent, setSkillContent] = useState("");

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/skills");
      if (response.ok) {
        const data: Skill[] = await response.json();
        setSkills(data);
      }
    } catch (error) {
      console.error("Error fetching skills:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = () => {
    // Open dialog to create new skill
    setCurrentSkill(null);
    setSkillContent("# New Skill\n\nDescribe the skill here...");
    setEditDialogOpen(true);
  };

  const handleEditSkill = (skill: Skill) => {
    // Load skill content
    fetch(`/api/fs/read?path=${encodeURIComponent(skill.filePath)}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setCurrentSkill(skill);
          setSkillContent(data.content || "");
          setEditDialogOpen(true);
        }
      });
  };

  const handleSaveSkill = async () => {
    if (!currentSkill && !skillContent.trim()) return;
    
    try {
      let filePath: string;
      
      if (currentSkill) {
        // Update existing skill
        filePath = currentSkill.filePath;
      } else {
        // Create new skill
        const name = prompt("Enter skill name:");
        if (!name) return;
        filePath = `.claude/skills/${name}.md`;
      }
      
      await fetch("/api/fs/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          content: skillContent
        })
      });
      
      setEditDialogOpen(false);
      fetchSkills(); // Refresh list
    } catch (error) {
      console.error("Error saving skill:", error);
    }
  };

  const handleDeleteSkill = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    
    try {
      await fetch("/api/fs/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: skill.filePath })
      });
      fetchSkills(); // Refresh list
    } catch (error) {
      console.error("Error deleting skill:", error);
    }
  };

  const toggleSkill = async (skill: Skill, enabled: boolean) => {
    // In a real implementation, this would update the enabled state in DB
    setSkills(skills.map(s => 
      s.id === skill.id ? { ...s, enabled } : s
    ));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Skills</h1>
      <p className="text-text-muted mb-8">Manage your AI skills as .md files in .claude/skills/</p>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-text-muted">Loading skills...</p>
        </div>
      ) : skills.length > 0 ? (
        <div className="space-y-4 mb-6">
          {skills.map((skill) => (
            <Card key={skill.id} className="border-border-subtle bg-bg-surface">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-primary font-medium">{skill.name}</span>
                      {skill.description && (
                        <span className="text-xs text-text-muted ml-2">• {skill.description}</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">{skill.filePath}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={skill.enabled}
                      onChange={(checked) => toggleSkill(skill, checked)}
                    />
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleEditSkill(skill)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => handleDeleteSkill(skill)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted italic mb-6">No skills configured</p>
      )}

      <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={handleAddSkill}>
        <Plus className="h-4 w-4" />
        Add Skill
      </Button>

      {/* Edit Skill Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} title="">
        <div className="py-4">
          <h3 className="text-lg font-semibold text-text-primary mb-2">{currentSkill ? `Edit: ${currentSkill.name}` : "Create New Skill"}</h3>
          <textarea
            value={skillContent}
            onChange={(e) => setSkillContent(e.target.value)}
            className="w-full h-64 p-3 border border-border-subtle rounded-md bg-bg-surface text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-border-strong"
            placeholder="Write your skill description in Markdown..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveSkill}>
            Save Skill
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
