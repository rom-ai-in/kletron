
export type PortalType = 'company' | 'tenant' | 'partner' | 'superadmin';

export interface BaseAccessMode {
    portal: PortalType;
}

export interface CompanyAccessMode extends BaseAccessMode {
    portal: 'company';
    companyId: string;
    tenantId: string;
    userId: string;
}

export interface TenantAccessMode extends BaseAccessMode {
    portal: 'tenant';
    tenantId: string;
    userId: string;
}

export interface PartnerAccessMode extends BaseAccessMode {
    portal: 'partner';
    partnerId: string;
    accessibleCompanyIds: string[];
    userId: string;
}

export interface SuperadminAccessMode extends BaseAccessMode {
    portal: 'superadmin';
    userId: string;
}

export type AccessMode =
    | CompanyAccessMode
    | TenantAccessMode
    | PartnerAccessMode
    | SuperadminAccessMode;

export function isCompanyAccessMode(mode: AccessMode): mode is CompanyAccessMode {
    return mode.portal === 'company';
}

export function isTenantAccessMode(mode: AccessMode): mode is TenantAccessMode {
    return mode.portal === 'tenant';
}

export function isPartnerAccessMode(mode: AccessMode): mode is PartnerAccessMode {
    return mode.portal === 'partner';
}

export function isSuperadminAccessMode(mode: AccessMode): mode is SuperadminAccessMode {
    return mode.portal === 'superadmin';
}
