import { toast } from '../components/toast';

export function renderLeadDetail(leadId, onUpdate) {
  toast.show('Abriendo detalle de lead: ' + leadId, 'info');
}
